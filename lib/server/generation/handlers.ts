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
import { PROMPT_VERSION, SYSTEM_PROMPT, buildRepairPrompt, buildSentenceCheckPrompt, buildUserPrompt, scenePrompt } from "./prompts";
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

  for (let index = 0; index < items; index++) {
    const contentKey = `plan:${plan.id}:${slug}:${index}:v1`;
    const existing = await db.practiceItem.findUnique({ where: { contentKey }, select: { id: true } });
    if (existing) {
      await setStage(job.id, workerId, "running", index + 1);
      continue; // checkpoint: never regenerate a stored item
    }
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
      const candidate = toStoredItem(slug, v.value);
      if (slug === "build-sentence") {
        const check = await verifyBuildSentence(job, index, v.value as z.infer<(typeof GEN_SCHEMAS)["build-sentence"]>);
        if (!check.ok) {
          lastErrors = [check.issue];
          continue;
        }
      }
      stored = candidate;
    }

    if (!stored) {
      log.warn("item rejected after repairs", { jobId: job.id, taskSlug: slug, itemIndex: index, errors: lastErrors.slice(0, 3) });
      throw new JobFailure("INVALID_OUTPUT", `Generated content failed validation: ${lastErrors.slice(0, 2).join("; ")}`.slice(0, 280), true);
    }

    await setStage(job.id, workerId, "storing");
    const item = await db.practiceItem.create({
      data: {
        contentKey,
        userId: job.userId,
        studyPlanId: plan.id,
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
        provenanceJson: { source: "generated", provider: "meta", modelId, promptVersion: PROMPT_VERSION, generationJobId: job.id, requestId, createdAt: new Date().toISOString() },
        validationStatus: "valid",
      },
    });
    await queueAssetsFor(job, item.id, slug, stored, input.accents);
    await setStage(job.id, workerId, "running", index + 1);
  }
  await db.generationJob.update({ where: { id: job.id }, data: { provider: "meta", modelId: env().META_TEXT_MODEL, promptVersion: PROMPT_VERSION } });
}

async function verifyBuildSentence(job: GenerationJob, index: number, v: z.infer<(typeof GEN_SCHEMAS)["build-sentence"]>): Promise<{ ok: true } | { ok: false; issue: string }> {
  const schema = z.strictObject({ grammatical: z.boolean(), uniqueOrder: z.boolean(), issue: z.string().max(300) });
  const r = await generateText({ task: "verify:build-sentence", schema, system: "You are a careful English grammar checker. Return JSON only.", user: buildSentenceCheckPrompt(v.context, v.prefix, v.tokens, v.suffix), temperature: 0 });
  await recordUsage({
    idempotencyKey: `meta:${r.requestId ?? `${job.id}:${index}:verify:${job.attemptCount}`}`,
    userId: job.userId,
    eventType: "content_validation",
    provider: "meta",
    modelId: r.model,
    inputUnits: r.usage.inputTokens,
    outputUnits: r.usage.outputTokens,
    generationJobId: job.id,
  });
  if (r.data.grammatical && r.data.uniqueOrder) return { ok: true };
  return { ok: false, issue: `Sentence check failed (grammatical=${r.data.grammatical}, unique=${r.data.uniqueOrder}): ${r.data.issue}` };
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
