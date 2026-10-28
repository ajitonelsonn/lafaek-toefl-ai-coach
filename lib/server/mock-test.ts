import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { certificateEligible } from "@/lib/config/certificate";
import { MOCK_BLUEPRINT, MOCK_SECTION_ORDER } from "@/lib/config/mock-test";
import type { PracticeSlug, SkillId } from "@/lib/config/practice-types";
import { estimateBandFromAccuracy, overallBand } from "@/lib/config/toefl-scale";
import type { PracticeView, WritingCheckDTO } from "@/lib/practice/dto";
import type { MockResultDTO, MockSectionResultDTO } from "@/lib/practice/mock-dto";
import { db } from "./db";
import { features, requireEnv } from "./env";
import { issueCertificate } from "./certificates";
import { useMockCredit } from "./credits";
import { ApiError } from "./http";
import { errorSummary, log } from "./log";
import { visibleTo } from "./practice";
import { bucketName, objectKeyFor, putObject } from "./storage/s3";
import { enqueueJob } from "./generation/queue";
import { buildView, unitIdsOf, type ItemWithMedia } from "./content/view";
import { scoreUnit } from "./content/scoring";

// Mock test assembled per learner and per attempt: for each section in MOCK_BLUEPRINT it takes
// questions earlier mock tests have not used, preferring the learner's own AI-generated ones (fewest
// practised first) over the shared starter set.
// Lifecycle: `startMockTest` uses one lifetime mock credit and stores the chosen form as a
// "started" row (reloading the session resumes it without using another credit); the form is
// signed (HMAC) for the browser, and `submitMockTest` scores exactly those questions once and marks
// the row "completed". Results are practice estimates, never official scores.
export const MOCK_SCORING_VERSION = "mock-2";
const FORM_TTL_MS = 8 * 3600_000;

export interface MockFormItem {
  skill: SkillId;
  slug: PracticeSlug;
  units: string[];
  view: PracticeView;
}

export type MockSectionResult = MockSectionResultDTO;
export type MockResult = MockResultDTO;

interface FormPayload {
  v: 2;
  id: string;
  u: string;
  t: number;
  s: SkillId[];
  f: [itemId: string, skill: SkillId, units: string[]][];
}

// --- signed form token ---------------------------------------------------------------------
const sign = (body: string) => createHmac("sha256", requireEnv("AUTH_SECRET").AUTH_SECRET).update(`mock-form:${body}`).digest("base64url");

function encodeForm(p: FormPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeForm(token: string, userId: string): FormPayload {
  const [body, mac] = token.split(".");
  const expected = body ? sign(body) : "";
  const ok = !!body && !!mac && mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  const p = ok ? (JSON.parse(Buffer.from(body, "base64url").toString()) as FormPayload) : null;
  if (!p || p.v !== 2 || p.u !== userId) throw new ApiError(400, "VALIDATION_ERROR", "This test could not be checked. Please start a new mock test.");
  if (Date.now() - p.t > FORM_TTL_MS) throw new ApiError(400, "VALIDATION_ERROR", "This test has expired. Please start a new mock test.");
  return p;
}

// --- stored results (format 1: array of sections; format 2: object) -------------------------
/** A Writing or Speaking answer waiting for AI rating (the email text is dropped once rated). */
export interface OpenResponse {
  itemId: string;
  unitId: string;
  skill: "writing" | "speaking";
  /** Absent on results stored before the full blueprint (then: write-email or take-interview). */
  slug?: PracticeSlug;
  answered: boolean;
  text?: string;
}

export interface StoredResult {
  format: 2;
  formId: string;
  itemIds: string[];
  personalised: number;
  estimatedBand: number | null;
  sections: MockSectionResult[];
  /** Absent on results from before Writing and Speaking were AI-rated. */
  scoring?: "pending" | "done";
  open?: OpenResponse[];
}
type Stored = MockSectionResult[] | StoredResult;

/** S3 role of a mock test Speaking recording (media_assets.attempt_id is the mock test id). */
export const mockRecordingRole = (itemId: string, unitId: string) => `mock:${itemId}:${unitId}`;
export const mockScoringKey = (mockId: string) => `${mockId}:mock_scoring`;

function toResult(row: { id: string; completedAt: Date; durationSeconds: number; sectionsJson: Prisma.JsonValue; certificate?: { code: string } | null }): MockResult {
  const s = row.sectionsJson as unknown as Stored;
  // Results in the first format stored no bands; newer ones store them (null while being rated).
  const sections = Array.isArray(s) ? s.map((x) => ({ ...x, band: x.band ?? (x.correct !== null ? estimateBandFromAccuracy(x.correct, x.total) : null) })) : s.sections;
  const bands = sections.map((x) => x.band).filter((b): b is number => b !== null);
  return {
    id: row.id,
    completedAt: row.completedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    sections,
    estimatedBand: Array.isArray(s) ? (bands.length ? overallBand(bands) : null) : s.estimatedBand,
    personalised: Array.isArray(s) ? 0 : s.personalised,
    scoring: Array.isArray(s) ? null : (s.scoring ?? null),
    certificateCode: row.certificate?.code ?? null,
  };
}

/** Marks results whose AI rating job gave up as "failed" (the learner can try again). */
async function withScoringStatus(results: MockResult[]): Promise<MockResult[]> {
  const pending = results.filter((r) => r.scoring === "pending");
  if (!pending.length) return results;
  const failed = new Set(
    (await db.generationJob.findMany({ where: { idempotencyKey: { in: pending.map((r) => mockScoringKey(r.id)) }, status: "failed" }, select: { idempotencyKey: true } })).map(
      (j) => j.idempotencyKey,
    ),
  );
  return results.map((r) => (r.scoring === "pending" && failed.has(mockScoringKey(r.id)) ? { ...r, scoring: "failed" } : r));
}

const usedItemIds = async (userId: string) =>
  new Set(
    (await db.mockTestResult.findMany({ where: { userId }, select: { sectionsJson: true, formJson: true }, orderBy: { completedAt: "desc" }, take: 50 })).flatMap((r) => {
      const form = r.formJson as unknown as FormPayload | null;
      if (form) return form.f.map(([id]) => id);
      const s = r.sectionsJson as unknown as Stored;
      return Array.isArray(s) ? [] : s.itemIds;
    }),
  );

const activeWhere = (userId: string) => ({ userId, status: "started", startedAt: { gt: new Date(Date.now() - FORM_TTL_MS) } });

/** Chooses the questions for a new mock test (personalised and unused first). */
async function pickItems(userId: string, sections: SkillId[]): Promise<MockFormItem[]> {
  const ordered = MOCK_SECTION_ORDER.filter((s) => sections.includes(s));
  const [used, attempted] = await Promise.all([usedItemIds(userId), db.practiceAttempt.findMany({ where: { userId }, select: { practiceItemId: true }, distinct: ["practiceItemId"] })]);
  const practised = new Set(attempted.map((a) => a.practiceItemId));
  const items: MockFormItem[] = [];

  for (const skill of ordered) {
    for (const part of MOCK_BLUEPRINT[skill]) {
      const rows = (await db.practiceItem.findMany({ where: { ...visibleTo(userId), taskSlug: part.slug }, include: { media: { where: { deletedAt: null } } } })) as ItemWithMedia[];
      // Unused in earlier mock tests first (so each test is new), then personal before starter, then
      // unpractised before practised; random within a tier.
      const rank = (r: ItemWithMedia) => (used.has(r.id) ? 4 : 0) + (r.userId ? 0 : 2) + (practised.has(r.id) ? 1 : 0);
      const picked = rows
        .map((r) => ({ r, k: rank(r) + Math.random() * 0.5 }))
        .sort((a, b) => a.k - b.k)
        .slice(0, part.items)
        .map((x) => x.r);
      for (const row of picked) {
        const units = unitIdsOf(part.slug, row);
        if (units.length) items.push({ skill, slug: part.slug, units, view: buildView(part.slug, [row]) });
      }
    }
  }
  return items;
}

/**
 * Starts a mock test: resumes the learner's unfinished one, or uses one mock credit and stores a
 * new form. Throws 402 UPGRADE_REQUIRED when no credits are left.
 */
export async function startMockTest(userId: string, sections: SkillId[]): Promise<{ id: string; resumed: boolean }> {
  const active = await db.mockTestResult.findFirst({ where: activeWhere(userId), select: { id: true } });
  if (active) return { id: active.id, resumed: true };
  const items = await pickItems(userId, sections);
  if (!items.length) throw new ApiError(409, "CONFLICT", "No questions are available for these sections yet.");
  const payload: FormPayload = {
    v: 2,
    id: randomUUID(),
    u: userId,
    t: Date.now(),
    s: MOCK_SECTION_ORDER.filter((s) => items.some((i) => i.skill === s)),
    f: items.map((i) => [itemIdOf(i.view), i.skill, i.units]),
  };
  return db.$transaction(
    async (tx) => {
      // Per-user lock: two quick clicks cannot start two tests or use two credits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724813, hashtext(${userId}))`;
      const again = await tx.mockTestResult.findFirst({ where: activeWhere(userId), select: { id: true } });
      if (again) return { id: again.id, resumed: true };
      await useMockCredit(tx, userId);
      await tx.mockTestResult.create({
        data: { id: payload.id, userId, status: "started", startedAt: new Date(), formJson: payload as unknown as Prisma.InputJsonValue, sectionsJson: [], durationSeconds: 0, scoringVersion: MOCK_SCORING_VERSION },
      });
      return { id: payload.id, resumed: false };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

/** The learner's unfinished mock test (questions and signed token), if one was started in the last 8 hours. */
export async function activeMockTest(userId: string): Promise<{ id: string; token: string; items: MockFormItem[]; startedAt: string; expiresAt: string } | null> {
  const row = await db.mockTestResult.findFirst({ where: activeWhere(userId) });
  const form = row?.formJson as unknown as FormPayload | null;
  if (!row || !form) return null;
  const rows = (await db.practiceItem.findMany({ where: { id: { in: form.f.map(([id]) => id) } }, include: { media: { where: { deletedAt: null } } } })) as ItemWithMedia[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = form.f.flatMap(([id, skill, units]) => {
    const r = byId.get(id);
    return r ? [{ skill, slug: r.taskSlug as PracticeSlug, units, view: buildView(r.taskSlug as PracticeSlug, [r]) }] : [];
  });
  return { id: row.id, token: encodeForm(form), items, startedAt: new Date(form.t).toISOString(), expiresAt: new Date(form.t + FORM_TTL_MS).toISOString() };
}

/** Credits left and any unfinished test, for the mock test start page. */
export async function mockStatus(userId: string): Promise<{ mockCredits: number; active: { startedAt: string; expiresAt: string } | null }> {
  const [user, row] = await Promise.all([db.user.findUnique({ where: { id: userId }, select: { mockCredits: true } }), db.mockTestResult.findFirst({ where: activeWhere(userId), select: { startedAt: true } })]);
  return {
    mockCredits: user?.mockCredits ?? 0,
    active: row?.startedAt ? { startedAt: row.startedAt.toISOString(), expiresAt: new Date(row.startedAt.getTime() + FORM_TTL_MS).toISOString() } : null,
  };
}

/** The single item id inside a one-item view. */
const itemIdOf = (view: PracticeView): string => view.items[0].itemId;

/**
 * Stores a Speaking answer recorded during a started mock test, so the worker can transcribe and
 * rate it after submit. Re-recording replaces it. The file is deleted once it has been rated.
 */
export async function saveMockRecording(userId: string, input: { token: string; itemId: string; unitId: string; wav: Buffer; durationMs: number }): Promise<void> {
  const form = decodeForm(input.token, userId);
  if (!form.f.some(([id, skill, units]) => id === input.itemId && skill === "speaking" && units.includes(input.unitId))) {
    throw new ApiError(400, "VALIDATION_ERROR", "This question is not part of your test.");
  }
  const open = await db.mockTestResult.findFirst({ where: { id: form.id, userId, status: "started" }, select: { id: true } });
  if (!open) throw new ApiError(409, "CONFLICT", "This test was already submitted.");
  if (!features.storage()) throw new ApiError(503, "CONFIGURATION_MISSING", "Recording storage is not set up, so Speaking cannot be scored.");

  const role = mockRecordingRole(input.itemId, input.unitId);
  const existing = await db.mediaAsset.findFirst({ where: { attemptId: form.id, role, deletedAt: null } });
  const assetId = existing?.id ?? randomUUID();
  const objectKey = existing?.objectKey ?? objectKeyFor({ ownerId: userId, attemptId: form.id, kind: "recording", assetId, mimeType: "audio/wav" });
  if (!existing) {
    await db.mediaAsset.create({ data: { id: assetId, userId, attemptId: form.id, kind: "recording", role, bucket: bucketName(), objectKey, mimeType: "audio/wav", status: "pending" } });
  }
  const up = await putObject(objectKey, input.wav, "audio/wav");
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "ready", byteSize: up.byteSize, checksum: up.checksum, durationMs: input.durationMs } });
}

/** Issues the certificate when the result qualifies; never fails the caller. */
export async function issueIfEligible(userId: string, result: MockResult): Promise<MockResult> {
  if (result.certificateCode || !certificateEligible(result)) return result;
  try {
    return { ...result, certificateCode: (await issueCertificate(userId, result)).code };
  } catch (err) {
    log.error("certificate not issued", { resultId: result.id, error: errorSummary(err) });
    return result;
  }
}

/**
 * Scores the started test once. Reading and Listening are scored at once; Writing and Speaking
 * answers are queued for AI rating (`mock_scoring` job), and the overall band follows when they are rated.
 */
export async function submitMockTest(userId: string, input: { token: string; answers: { itemId: string; unitId: string; response: unknown }[]; durationSeconds: number }) {
  const form = decodeForm(input.token, userId);
  const started = await db.mockTestResult.findFirst({ where: { id: form.id, userId }, select: { status: true } });
  if (!started) throw new ApiError(400, "VALIDATION_ERROR", "This test could not be checked. Please start a new mock test.");
  if (started.status === "completed") throw new ApiError(409, "CONFLICT", "This test was already submitted.");

  const ids = [...new Set(form.f.map(([id]) => id))];
  const rows = await db.practiceItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const answerFor = (itemId: string, unitId: string) => input.answers.find((a) => a.itemId === itemId && a.unitId === unitId);
  const open: OpenResponse[] = [];

  // A section can mix auto-scored questions (e.g. Build a Sentence) with answers the AI rates later
  // (the email and the discussion post); its band then waits for the rating job.
  const sections: MockSectionResult[] = form.s.map((skill) => {
    let correct = 0;
    let objectiveTotal = 0;
    let total = 0;
    let answered = 0;
    let rated = 0;
    const words: string[] = [];
    let checks: WritingCheckDTO[] | undefined;
    for (const [itemId, s, units] of form.f) {
      if (s !== skill) continue;
      const row = byId.get(itemId);
      if (!row) continue;
      const slug = row.taskSlug as PracticeSlug;
      for (const unit of units) {
        total++;
        const a = answerFor(itemId, unit);
        if (a) answered++;
        if (skill === "speaking") {
          open.push({ itemId, unitId: unit, skill, slug, answered: !!a });
          rated++;
          continue;
        }
        const r = scoreUnit(slug, row, unit, a?.response);
        if (r.correct !== null) {
          objectiveTotal++;
          if (r.correct) correct++;
        } else if (r.checks) {
          checks = [...(checks ?? []), ...r.checks];
          const body = ((a?.response as { body?: string } | undefined)?.body ?? "").trim().slice(0, 6000);
          open.push({ itemId, unitId: unit, skill: "writing", slug, answered: !!body, text: body });
          rated++;
          words.push(`${body ? body.split(/\s+/).length : 0} words in ${slug === "write-email" ? "your email" : "your discussion post"}`);
        }
      }
    }
    let note = words.length ? `${words.join(", ")}.` : undefined;
    if (skill === "speaking") note = answered ? `${answered} of ${total} answers recorded.` : "No answers recorded.";
    const band = objectiveTotal && !rated ? estimateBandFromAccuracy(correct, objectiveTotal) : null;
    return {
      skill,
      correct: objectiveTotal ? correct : null,
      total,
      answered,
      band,
      ...(objectiveTotal && objectiveTotal !== total ? { objectiveTotal } : {}),
      ...(note ? { note } : {}),
      ...(checks ? { checks } : {}),
    };
  });

  const bands = sections.map((s) => s.band).filter((b): b is number => b !== null);
  const personalised = rows.length ? rows.filter((r) => r.userId === userId).length / rows.length : 0;
  const stored: StoredResult = {
    format: 2,
    formId: form.id,
    itemIds: ids,
    personalised,
    // With Writing or Speaking in the test, the overall band waits for their AI rating.
    estimatedBand: open.length ? null : bands.length ? overallBand(bands) : null,
    sections,
    ...(open.length ? { scoring: "pending" as const, open } : {}),
  };
  // Only a still-started row is completed (a parallel submit of the same test loses).
  const done = await db.mockTestResult.updateMany({
    where: { id: form.id, userId, status: "started" },
    data: { status: "completed", sectionsJson: stored as unknown as Prisma.InputJsonValue, durationSeconds: Math.min(input.durationSeconds, 4 * 3600), completedAt: new Date() },
  });
  if (done.count !== 1) throw new ApiError(409, "CONFLICT", "This test was already submitted.");
  if (open.length) await enqueueJob({ idempotencyKey: mockScoringKey(form.id), jobType: "mock_scoring", userId, payload: { mockResultId: form.id } });
  return issueIfEligible(userId, toResult(await db.mockTestResult.findUniqueOrThrow({ where: { id: form.id } })));
}

/** Queues the AI rating again after it failed (e.g. the provider was down). */
export async function retryMockScoring(userId: string, id: string): Promise<void> {
  const result = await mockResult(userId, id);
  if (result.scoring !== "failed") throw new ApiError(409, "CONFLICT", "This test is not waiting to be scored again.");
  await db.generationJob.updateMany({
    where: { idempotencyKey: mockScoringKey(id), status: "failed" },
    data: { status: "queued", attemptCount: 0, nextAttemptAt: new Date(), errorCode: null, errorSummary: null, finishedAt: null },
  });
}

/** The learner's mock tests, newest first. */
export async function mockHistory(userId: string, take = 20): Promise<MockResult[]> {
  const rows = await db.mockTestResult.findMany({ where: { userId, status: "completed" }, orderBy: { completedAt: "desc" }, take, include: { certificate: { select: { code: true } } } });
  return withScoringStatus(rows.map(toResult));
}

/** One completed mock test of `userId` (404 when it is not theirs or not finished). */
export async function mockResult(userId: string, id: string): Promise<MockResult> {
  const row = await db.mockTestResult.findFirst({ where: { id, userId, status: "completed" }, include: { certificate: { select: { code: true } } } });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Mock test not found.");
  return (await withScoringStatus([toResult(row)]))[0];
}

export async function latestMockResult(userId: string): Promise<MockResult | null> {
  return (await mockHistory(userId, 1))[0] ?? null;
}
