import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type GenerationJob } from "@prisma/client";
import { z } from "zod";
import type { PracticeSlug } from "@/lib/config/practice-types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";
import { db } from "../db";
import { env, features } from "../env";
import { errorSummary, log } from "../log";
import { recordUsage } from "../usage";
import { ProviderError } from "../providers/http";
import { generateImage, generateText } from "../providers/meta";
import { pickVoices, synthesizeSpeech } from "../providers/elevenlabs";
import { bucketName, deleteObject, objectExists, objectKeyFor, putObject } from "../storage/s3";
import { GEN_SCHEMAS, toStoredItem, validateGenerated, type StoredItem } from "../content/schemas";
import { cefrForLevel } from "../study-plan";
import { PROMPT_VERSION, SYSTEM_PROMPT, batchPrompt, buildRepairPrompt, buildSentenceBatchCheckPrompt, buildSentenceBatchPrompt, buildUserPrompt, scenePrompt, type PromptContext } from "./prompts";
import { enqueueJob, heartbeat, setStage } from "./queue";

export class JobFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly blocked = false,
  ) {
    super(message);
  }
}

export function toJobFailure(err: unknown): JobFailure {
  if (err instanceof JobFailure) return err;
  if (err instanceof ProviderError) {
    if (err.kind === "not_configured") return new JobFailure("PROVIDER_NOT_CONFIGURED", err.message, false, true);
    // A rejected key or unknown model is a deployment setting, not bad content: wait for the
    // fix (re-queued when the worker restarts) instead of failing and using learner retries.
    if (err.kind === "auth" || err.code === "model_not_found") return new JobFailure("PROVIDER_CONFIG", err.message, false, true);
    return new JobFailure(`PROVIDER_${err.kind.toUpperCase()}`, err.message, err.retryable);
  }
  if (err instanceof Error && "code" in err && (err as { code: string }).code === "CONFIGURATION_MISSING") return new JobFailure("CONFIGURATION_MISSING", err.message, false, true);
  return new JobFailure("INTERNAL", errorSummary(err), true);
}

const MAX_REPAIRS = 2;

// ---------------------------------------------------------------------------
// Task pack: generate, validate and store N items for one task type.
// ---------------------------------------------------------------------------

export async function runTaskPack(job: GenerationJob, workerId: string): Promise<void> {
  const slug = job.taskSlug as PracticeSlug;
  const { studyPlanId, items } = job.payloadJson as { studyPlanId: string; items: number };
  const plan = await db.studyPlan.findUnique({ where: { id: studyPlanId } });
  if (!plan || !job.userId) throw new JobFailure("PLAN_MISSING", "Study plan not found.", false);
  const input = (plan.answersJson as unknown as { input: StudyPlanInputBody }).input;

  await enforceDailyLimit(job.userId);
  // The large packs of short items are written several per call (much faster; see below).
  const spec = BATCHED[slug];
  if (spec) return runBatchedPack(job, workerId, plan, input, items, slug, spec);

  // A question that still fails its checks after repairs is skipped and replaced at the next slot
  // (up to 10% extra slots, at least 2), so one bad question cannot hold up the whole pack.
  const spareSlots = Math.max(2, Math.ceil(items * 0.1));
  let storedCount = await db.practiceItem.count({ where: { studyPlanId: plan.id, taskSlug: slug, userId: job.userId } });
  let lastRejection: string[] = [];
  for (let index = 0; storedCount < items && index < items + spareSlots; index++) {
    const contentKey = `plan:${plan.id}:${slug}:${index}:v1`;
    const existing = await db.practiceItem.findUnique({ where: { contentKey }, select: { id: true } });
    if (existing) continue; // checkpoint: never regenerate a stored item (already counted)
    if (!(await heartbeat(job.id, workerId))) throw new JobFailure("LEASE_LOST", "Lease lost.", true);

    const usedTopics = (await db.practiceItem.findMany({ where: { userId: job.userId, taskSlug: slug }, select: { topic: true } })).map((t) => t.topic);
    const userPrompt = buildUserPrompt(slug, { cefrLevel: cefrForLevel(input.level), itemIndex: index, weakAreas: input.weakAreas, goals: input.goals, avoidTopics: usedTopics });

    let stored: StoredItem | null = null;
    let lastErrors: string[] = [];
    let modelId = env().META_TEXT_MODEL;
    let requestId: string | null = null;
    for (let attempt = 0; attempt <= MAX_REPAIRS && !stored; attempt++) {
      const prompt = attempt === 0 ? userPrompt : buildRepairPrompt(userPrompt, lastErrors);
      let raw: unknown;
      try {
        const r = await generateText({ task: `generate:${slug}`, schema: GEN_SCHEMAS[slug] as z.ZodType, system: SYSTEM_PROMPT, user: prompt });
        raw = r.data;
        modelId = r.model;
        requestId = r.requestId;
        await recordUsage({
          idempotencyKey: `meta:${r.requestId ?? `${job.id}:${index}:${job.attemptCount}:${attempt}`}`,
          userId: job.userId,
          eventType: "text_generation",
          provider: "meta",
          modelId: r.model,
          inputUnits: r.usage.inputTokens,
          outputUnits: r.usage.outputTokens,
          generationJobId: job.id,
          metadata: { taskSlug: slug, itemIndex: index },
        });
      } catch (e) {
        if (e instanceof ProviderError && e.kind === "invalid_output") {
          lastErrors = [e.message];
          continue;
        }
        throw e;
      }

      await setStage(job.id, workerId, "validating");
      const v = validateGenerated(slug, raw);
      if (!v.ok) {
        lastErrors = v.errors;
        continue;
      }
      stored = toStoredItem(slug, v.value);
    }

    if (!stored) {
      log.warn("item rejected after repairs; replacing it", { jobId: job.id, taskSlug: slug, itemIndex: index, errors: lastErrors.slice(0, 3) });
      lastRejection = lastErrors;
      continue;
    }

    await setStage(job.id, workerId, "storing");
    await saveItem(job, plan.id, slug, index, stored, { modelId, requestId }, input.accents);
    storedCount++;
    await setStage(job.id, workerId, "running", Math.min(storedCount, items));
  }
  if (storedCount < items) {
    // Too many rejections in one run: retry later (stored questions are kept; the skipped slots are tried again).
    throw new JobFailure("INVALID_OUTPUT", `Only ${storedCount} of ${items} questions passed the checks. Last issue: ${lastRejection.slice(0, 2).join("; ")}`.slice(0, 280), true);
  }
  await db.generationJob.update({ where: { id: job.id }, data: { provider: "meta", modelId: env().META_TEXT_MODEL, promptVersion: PROMPT_VERSION } });
}

/** Stores one validated item at slot `index` and queues its audio/images. */
async function saveItem(job: GenerationJob, studyPlanId: string, slug: PracticeSlug, index: number, stored: StoredItem, meta: { modelId: string; requestId: string | null }, accents: string[]) {
  const item = await db.practiceItem.create({
    data: {
      contentKey: `plan:${studyPlanId}:${slug}:${index}:v1`,
      userId: job.userId,
      studyPlanId,
      generationJobId: job.id,
      source: "generated",
      taskSlug: slug,
      itemIndex: index,
      difficulty: stored.difficulty,
      cefrLevel: stored.cefrLevel,
      topic: stored.topic,
      contentJson: { ...stored.content, ...(stored.imagePrompt ? { imagePrompt: stored.imagePrompt } : {}) } as Prisma.InputJsonValue,
      answerKeyJson: stored.answerKey as Prisma.InputJsonValue,
      explanationJson: stored.explanation as Prisma.InputJsonValue,
      rubricJson: (stored.rubric ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      provenanceJson: { source: "generated", provider: "meta", modelId: meta.modelId, promptVersion: PROMPT_VERSION, generationJobId: job.id, requestId: meta.requestId, createdAt: new Date().toISOString() },
      validationStatus: "valid",
    },
  });
  await queueAssetsFor(job, item.id, slug, stored, accents);
}

// ---------------------------------------------------------------------------
// Batched packs: one call writes several items (Build a Sentence 5, Listen and Choose a Response 10).
// Build a Sentence also gets one call that checks the whole batch (grammar and a unique word order).
// Passing items fill the next free slots; rejected ones are replaced by the next batch, within a
// budget of about twice the target so a bad run cannot loop forever.
// ---------------------------------------------------------------------------

type SentenceItem = z.infer<(typeof GEN_SCHEMAS)["build-sentence"]>;
type Verdicts = Map<number, { ok: boolean; issue: string }>;

interface BatchSpec {
  size: number;
  timeoutSeconds: number;
  prompt: (ctx: PromptContext, count: number, toFix: { item: never; issue: string }[]) => string;
  /** Optional second-pass check of the whole batch; rejected items go back to be corrected. */
  check?: (job: GenerationJob, batch: number, items: never[]) => Promise<Verdicts>;
  /** Adjusts a raw item before validation. */
  prepare?: (raw: unknown) => unknown;
  /** Less model reasoning for faster batches (measured to keep quality for Build a Sentence). */
  reasoningEffort?: "low";
}

const BATCHED: Partial<Record<PracticeSlug, BatchSpec>> = {
  // A real batch of 5 took about 33 s to write and 96 s to check (2026-10-28), so allow more than the default.
  // Low reasoning: ~11 s per accepted item instead of ~90 s (2026-10-30 measurement, 73% pass the check).
  "build-sentence": { size: 5, timeoutSeconds: 240, prompt: buildSentenceBatchPrompt, check: verifyBuildSentences, reasoningEffort: "low" },
  // Short items (one spoken line + four replies): 10 per call turns 50 calls into 5.
  "listen-choose-response": { size: 10, timeoutSeconds: 180, prompt: (ctx, count) => batchPrompt("listen-choose-response", ctx, count), prepare: shuffleChoices },
};

/**
 * Moves the correct reply to a random position: in a batch the model tends to put it in the same
 * place every time. Skipped when the explanation names a letter, which would then be wrong.
 */
function shuffleChoices(raw: unknown): unknown {
  const v = raw as { options?: unknown; answerIndex?: unknown; explanation?: unknown } | null;
  if (!v || !Array.isArray(v.options) || typeof v.answerIndex !== "number" || !v.options[v.answerIndex]) return raw;
  if (typeof v.explanation === "string" && /\b(option|answer|choice|response|reply)\s+[A-D]\b|\([A-D]\)/i.test(v.explanation)) return raw;
  const options = [...v.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...v, options, answerIndex: options.indexOf(v.options[v.answerIndex]) };
}

async function runBatchedPack(job: GenerationJob, workerId: string, plan: { id: string }, input: StudyPlanInputBody, items: number, slug: PracticeSlug, spec: BatchSpec): Promise<void> {
  const existing = await db.practiceItem.findMany({ where: { studyPlanId: plan.id, taskSlug: slug, userId: job.userId }, select: { itemIndex: true } });
  const taken = new Set(existing.map((i) => i.itemIndex));
  let storedCount = taken.size;
  let nextSlot = 0;
  const claimSlot = () => {
    while (taken.has(nextSlot)) nextSlot++;
    taken.add(nextSlot);
    return nextSlot;
  };
  const budget = Math.ceil(items * 2) + spec.size;
  let requested = 0;
  let lastIssues: string[] = [];
  // Rejected items go back with the checker's reason, to be corrected in the next batch (like repairs).
  let toFix: { item: unknown; issue: string }[] = [];
  const batchSchema = z.strictObject({ items: z.array(GEN_SCHEMAS[slug]).min(1).max(spec.size) });

  for (let batch = 0; storedCount < items && requested < budget; batch++) {
    if (!(await heartbeat(job.id, workerId))) throw new JobFailure("LEASE_LOST", "Lease lost.", true);
    const want = Math.min(spec.size, items - storedCount);
    requested += want;
    const usedTopics = (await db.practiceItem.findMany({ where: { userId: job.userId, taskSlug: slug }, select: { topic: true } })).map((t) => t.topic);
    const ctx = { cefrLevel: cefrForLevel(input.level), itemIndex: storedCount + batch, weakAreas: input.weakAreas, goals: input.goals, avoidTopics: usedTopics };

    let raw: unknown;
    let meta: { modelId: string; requestId: string | null };
    try {
      const r = await generateText({ task: `generate:${slug}-batch`, schema: batchSchema as z.ZodType, system: SYSTEM_PROMPT, user: spec.prompt(ctx, want, toFix as never[]), timeoutSeconds: spec.timeoutSeconds, reasoningEffort: spec.reasoningEffort });
      raw = r.data;
      meta = { modelId: r.model, requestId: r.requestId };
      await recordUsage({
        idempotencyKey: `meta:${r.requestId ?? `${job.id}:${slug}-batch:${job.attemptCount}:${batch}`}`,
        userId: job.userId,
        eventType: "text_generation",
        provider: "meta",
        modelId: r.model,
        inputUnits: r.usage.inputTokens,
        outputUnits: r.usage.outputTokens,
        generationJobId: job.id,
        metadata: { taskSlug: slug, batch, count: want },
      });
    } catch (e) {
      if (e instanceof ProviderError && e.kind === "invalid_output") {
        lastIssues = [e.message];
        continue;
      }
      throw e;
    }

    await setStage(job.id, workerId, "validating");
    const list = (raw as { items?: unknown[] } | null)?.items;
    const valid: { value: unknown; stored: StoredItem }[] = [];
    for (const candidate of Array.isArray(list) ? list.slice(0, want) : []) {
      const v = validateGenerated(slug, spec.prepare ? spec.prepare(candidate) : candidate);
      if (v.ok) valid.push({ value: v.value, stored: toStoredItem(slug, v.value) });
      else lastIssues = v.errors;
    }
    if (!valid.length) continue;

    const verdicts: Verdicts | null = spec.check ? await spec.check(job, batch, valid.map((x) => x.value) as never[]) : null;
    const rejected: string[] = [];
    const nextFix: { item: unknown; issue: string }[] = [];
    await setStage(job.id, workerId, "storing");
    for (const [i, x] of valid.entries()) {
      const verdict = verdicts ? verdicts.get(i + 1) : { ok: true, issue: "" };
      if (!verdict?.ok) {
        const issue = verdict?.issue ?? "No verdict returned for this item.";
        rejected.push(issue);
        nextFix.push({ item: x.value, issue });
        continue;
      }
      if (storedCount >= items) break;
      await saveItem(job, plan.id, slug, claimSlot(), x.stored, meta, input.accents);
      storedCount++;
    }
    toFix = nextFix;
    if (rejected.length) {
      lastIssues = rejected;
      log.warn("items rejected by the check; the next batch corrects them", { jobId: job.id, taskSlug: slug, batch, rejected: rejected.length, of: valid.length, issues: rejected.slice(0, 2) });
    }
    await setStage(job.id, workerId, "running", Math.min(storedCount, items));
  }

  if (storedCount < items) {
    throw new JobFailure("INVALID_OUTPUT", `Only ${storedCount} of ${items} questions passed the checks. Last issue: ${lastIssues.slice(0, 2).join("; ")}`.slice(0, 280), true);
  }
  await db.generationJob.update({ where: { id: job.id }, data: { provider: "meta", modelId: env().META_TEXT_MODEL, promptVersion: PROMPT_VERSION } });
}

/** Checks several Build a Sentence items in one call; returns a verdict per item number (1-based). */
async function verifyBuildSentences(job: GenerationJob, batch: number, items: SentenceItem[]): Promise<Verdicts> {
  const schema = z.strictObject({
    results: z.array(z.strictObject({ n: z.number().int().min(1), grammatical: z.boolean(), uniqueOrder: z.boolean(), issue: z.string().max(300) })).min(1).max(items.length),
  });
  const r = await generateText({
    task: "verify:build-sentence-batch",
    schema,
    system: "You are a careful English grammar checker. Return JSON only.",
    user: buildSentenceBatchCheckPrompt(items),
    temperature: 0,
    timeoutSeconds: BATCHED["build-sentence"]!.timeoutSeconds,
    // Agreed with the full-reasoning check on 9 of 10 items, about 3× faster.
    reasoningEffort: "low",
  });
  await recordUsage({
    idempotencyKey: `meta:${r.requestId ?? `${job.id}:bs-verify:${job.attemptCount}:${batch}`}`,
    userId: job.userId,
    eventType: "content_validation",
    provider: "meta",
    modelId: r.model,
    inputUnits: r.usage.inputTokens,
    outputUnits: r.usage.outputTokens,
    generationJobId: job.id,
  });
  return new Map(
    r.data.results.map((x) => [x.n, { ok: x.grammatical && x.uniqueOrder, issue: `Sentence check failed (grammatical=${x.grammatical}, unique=${x.uniqueOrder}): ${x.issue}` }]),
  );
}

async function enforceDailyLimit(userId: string) {
  const limit = env().GENERATION_DAILY_USER_LIMIT;
  if (!limit) return;
  const since = new Date(Date.now() - 86_400_000);
  const count = await db.practiceItem.count({ where: { userId, source: "generated", createdAt: { gte: since } } });
  if (count >= limit) throw new JobFailure("DAILY_LIMIT", "Daily generation limit reached; will continue later.", true);
}

async function queueAssetsFor(job: GenerationJob, itemId: string, slug: PracticeSlug, stored: StoredItem, accents: string[]) {
  const blocked = !features.storage();
  if (stored.audioPlan.length) {
    await enqueueJob({
      idempotencyKey: `${itemId}:asset_audio`,
      jobType: "asset_audio",
      userId: job.userId,
      batchId: null,
      taskSlug: slug,
      payload: { itemId, accents },
      progressTotal: stored.audioPlan.reduce((n, s) => n + s.lines.length, 0),
      blocked: blocked || !features.tts(),
    });
  }
  if (stored.imagePrompt) {
    await enqueueJob({ idempotencyKey: `${itemId}:asset_image`, jobType: "asset_image", userId: job.userId, taskSlug: slug, payload: { itemId }, blocked });
  }
}

// ---------------------------------------------------------------------------
// Audio: one MP3 per script line via ElevenLabs, stored privately in S3.
// ---------------------------------------------------------------------------

export async function runAudioAsset(job: GenerationJob, workerId: string): Promise<void> {
  if (!features.storage()) throw new JobFailure("CONFIGURATION_MISSING", "S3_BUCKET is not configured.", false, true);
  const { itemId, accents } = job.payloadJson as { itemId: string; accents: string[] };
  const item = await db.practiceItem.findUnique({ where: { id: itemId } });
  if (!item) throw new JobFailure("ITEM_MISSING", "Practice item not found.", false);
  const slug = item.taskSlug as PracticeSlug;
  const plan = audioPlanFromContent(slug, item.contentJson as Record<string, unknown>);

  const speakerIds = [...new Set(plan.flatMap((s) => s.lines.map((l) => l.speaker.id)))];
  const seed = [...item.id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const voices = await pickVoices(speakerIds.length, accents ?? [], seed);
  let done = 0;
  for (const segment of plan) {
    for (let n = 0; n < segment.lines.length; n++) {
      const role = `audio:${segment.role}:${n}`;
      const existing = await db.mediaAsset.findFirst({ where: { practiceItemId: item.id, role, status: "ready", deletedAt: null } });
      if (existing) {
        done++;
        continue;
      }
      if (!(await heartbeat(job.id, workerId))) throw new JobFailure("LEASE_LOST", "Lease lost.", true);
      const line = segment.lines[n];
      const voice = voices[speakerIds.indexOf(line.speaker.id)];
      const audio = await synthesizeSpeech(line.text, voice.voiceId);
      await storeAsset({
        job,
        item,
        role,
        kind: "audio",
        bytes: audio.bytes,
        mimeType: audio.mimeType,
        provider: "elevenlabs",
        modelId: audio.model,
        voiceProfile: { speakerId: line.speaker.id, role: line.speaker.role, locale: voice.locale, voiceId: voice.voiceId, provider: "elevenlabs", modelId: audio.model },
        durationMs: Math.round((audio.bytes.length * 8) / 128), // 128 kbps estimate
      });
      await recordUsage({
        idempotencyKey: `elevenlabs:${item.id}:${role}`,
        userId: item.userId,
        eventType: "speech_synthesis",
        provider: "elevenlabs",
        modelId: audio.model,
        characterCount: audio.characters,
        audioSeconds: Math.round(audio.bytes.length / 16000),
        isEstimate: true,
        generationJobId: job.id,
      });
      done++;
      await setStage(job.id, workerId, "running", done);
    }
  }
}

function audioPlanFromContent(slug: PracticeSlug, c: Record<string, unknown>): StoredItem["audioPlan"] {
  type Line = { speaker: { id: string; role: string; name: string }; text: string };
  switch (slug) {
    case "listen-choose-response":
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk":
      return [{ role: "main", lines: c.script as Line[] }];
    case "listen-repeat":
      return (c.script as string[]).map((text, i) => ({ role: `r${i + 1}`, lines: [{ speaker: { id: "S1", role: "narrator", name: "Speaker" }, text }] }));
    case "take-interview":
      return (c.questions as { id: string; text: string }[]).map((q) => ({ role: q.id, lines: [{ speaker: { id: "S1", role: "interviewer", name: "Interviewer" }, text: q.text }] }));
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Image: one illustration via Meta Muse Image, stored privately in S3.
// ---------------------------------------------------------------------------

export async function runImageAsset(job: GenerationJob, workerId: string): Promise<void> {
  if (!features.storage()) throw new JobFailure("CONFIGURATION_MISSING", "S3_BUCKET is not configured.", false, true);
  const { itemId } = job.payloadJson as { itemId: string };
  const item = await db.practiceItem.findUnique({ where: { id: itemId } });
  if (!item) throw new JobFailure("ITEM_MISSING", "Practice item not found.", false);
  const role = "image:main";
  if (await db.mediaAsset.findFirst({ where: { practiceItemId: item.id, role, status: "ready", deletedAt: null } })) return;
  const desc = (item.contentJson as { imagePrompt?: string }).imagePrompt ?? (await imagePromptFromProvenance(item.id));
  if (!desc) return;
  if (!(await heartbeat(job.id, workerId))) throw new JobFailure("LEASE_LOST", "Lease lost.", true);
  const img = await generateImage(scenePrompt(desc), { size: "1536x1024" });
  await storeAsset({ job, item, role, kind: "image", bytes: img.bytes, mimeType: img.mimeType, provider: "meta", modelId: img.model });
  await recordUsage({ idempotencyKey: `meta:image:${item.id}:${role}`, userId: item.userId, eventType: "image_generation", provider: "meta", modelId: img.model, imageCount: 1, generationJobId: job.id });
}

async function imagePromptFromProvenance(itemId: string): Promise<string | null> {
  const item = await db.practiceItem.findUnique({ where: { id: itemId }, select: { topic: true, taskSlug: true } });
  return item ? `${item.topic} (${item.taskSlug.replace(/-/g, " ")})` : null;
}

async function storeAsset(a: {
  job: GenerationJob;
  item: { id: string; userId: string | null; taskSlug: string };
  role: string;
  kind: "audio" | "image";
  bytes: Buffer;
  mimeType: string;
  provider: string;
  modelId: string;
  voiceProfile?: Record<string, unknown>;
  durationMs?: number;
}) {
  const assetId = randomUUID();
  const objectKey = objectKeyFor({ ownerId: a.item.userId, taskSlug: a.item.taskSlug, itemId: a.item.id, kind: a.kind, assetId, mimeType: a.mimeType });
  // Record intent first (pending), upload, verify, then mark ready. A crash between
  // upload and the final update is repaired by the reconcile_media job.
  await db.mediaAsset.create({
    data: {
      id: assetId,
      userId: a.item.userId,
      practiceItemId: a.item.id,
      generationJobId: a.job.id,
      kind: a.kind,
      role: a.role,
      bucket: bucketName(),
      objectKey,
      mimeType: a.mimeType,
      provider: a.provider,
      modelId: a.modelId,
      voiceProfileJson: (a.voiceProfile ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      status: "pending",
    },
  });
  const { byteSize, checksum } = await putObject(objectKey, a.bytes, a.mimeType);
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "ready", byteSize, checksum, durationMs: a.durationMs ?? null } });
}

// ---------------------------------------------------------------------------
// Reconciliation and deletion.
// ---------------------------------------------------------------------------

/** Pending assets older than an hour: attach if the object exists, else mark failed. */
export async function reconcileMedia(): Promise<{ attached: number; failed: number }> {
  if (!features.storage()) return { attached: 0, failed: 0 };
  const stale = await db.mediaAsset.findMany({ where: { status: "pending", createdAt: { lt: new Date(Date.now() - 3_600_000) } }, take: 100 });
  let attached = 0;
  let failed = 0;
  for (const m of stale) {
    if (await objectExists(m.objectKey)) {
      await db.mediaAsset.update({ where: { id: m.id }, data: { status: "ready" } });
      attached++;
    } else {
      await db.mediaAsset.update({ where: { id: m.id }, data: { status: "failed" } });
      failed++;
    }
  }
  return { attached, failed };
}

/** Deletes a user's S3 objects (idempotent); database rows are removed by the account deletion. */
export async function runDeleteUserAssets(job: GenerationJob): Promise<void> {
  const { objectKeys } = job.payloadJson as { objectKeys: string[] };
  if (!objectKeys.length) return;
  if (!features.storage()) throw new JobFailure("CONFIGURATION_MISSING", "S3_BUCKET is not configured.", false, true);
  for (const key of objectKeys) await deleteObject(key);
}
