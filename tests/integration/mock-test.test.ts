import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { MOCK_BLUEPRINT, mockQuestionCount } from "@/lib/config/mock-test";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import { db } from "@/lib/server/db";
import { getCredits, grantBoostPacks } from "@/lib/server/credits";
import { activeMockTest, mockHistory, mockResult, retryMockScoring, saveMockRecording, startMockTest, submitMockTest } from "@/lib/server/mock-test";
import { runMockScoring } from "@/lib/server/mock-scoring";
import { findCertificate, issueCertificate } from "@/lib/server/certificates";
import { createUser, resetTestDb } from "../support/db";
import { fakeItems } from "../support/items";

// Meta and S3 are replaced: the AI rates every answer band 5, and recordings live in memory.
const objects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/lib/server/providers/meta", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/providers/meta")>()),
  generateText: vi.fn(async ({ user }: { user: string }) => ({
    data: { responses: [...user.matchAll(/### Answer id: (\S+)/g)].map((m) => ({ id: m[1], band: 5, comment: "Clear and relevant, with good detail." })) },
    usage: { inputTokens: 100, outputTokens: 50 },
    model: "test-model",
    requestId: null,
  })),
  transcribeAudio: vi.fn(async () => ({ transcript: "I would like this job because I enjoy helping people and I work well in a team.", audioDurationMs: 20_000, model: "test-asr" })),
}));
vi.mock("@/lib/server/storage/s3", () => ({
  bucketName: () => "test-bucket",
  objectKeyFor: (a: { ownerId: string; attemptId: string; assetId: string }) => `users/${a.ownerId}/recordings/${a.attemptId}/${a.assetId}.wav`,
  putObject: async (key: string, bytes: Buffer) => (objects.set(key, bytes), { byteSize: bytes.length, checksum: "test" }),
  getObject: async (key: string) => objects.get(key)!,
  deleteObject: async (key: string) => void objects.delete(key),
}));
vi.mock("@/lib/server/env", async (orig) => {
  const m = await orig<typeof import("@/lib/server/env")>();
  return { ...m, features: { ...m.features, storage: () => true } };
});

const ALL: SkillId[] = SKILLS.map((s) => s.id);
const MOCK_SLUGS = new Set(Object.values(MOCK_BLUEPRINT).flat().map((b) => b.slug));
type Form = NonNullable<Awaited<ReturnType<typeof activeMockTest>>>;

/** Starter set for everyone, plus two personalised copies of each mock task type for `userId`. */
async function seed(userId: string) {
  const starter = fakeItems().map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== "media")) as Prisma.PracticeItemCreateManyInput);
  await db.practiceItem.createMany({ data: starter.map((i) => ({ ...i, contentKey: `starter-test:${i.id}` })) });
  const personal = starter
    .filter((i) => MOCK_SLUGS.has(i.taskSlug as never) && (i.itemIndex ?? 0) < 2)
    .map((i, n) => ({ ...Object.fromEntries(Object.entries(i).filter(([k]) => k !== "id")), userId, source: "generated" as const, contentKey: `personal-test:${n}` }));
  await db.practiceItem.createMany({ data: personal as Prisma.PracticeItemCreateManyInput[] });
}

/** Starts a test and returns the stored form, as the session page would load it. */
async function begin(userId: string, sections: SkillId[] = ALL): Promise<Form> {
  await startMockTest(userId, sections);
  return (await activeMockTest(userId))!;
}

/** Correct answers for every objective unit of a form (read from the server-side keys). */
async function perfectAnswers(items: Form["items"]) {
  const out: { itemId: string; unitId: string; response: unknown }[] = [];
  for (const f of items) {
    const itemId = f.view.items[0].itemId;
    const row = await db.practiceItem.findUniqueOrThrow({ where: { id: itemId } });
    for (const unitId of f.units) {
      if (f.skill === "reading" || f.skill === "listening") out.push({ itemId, unitId, response: (row.answerKeyJson as Record<string, string>)[unitId] });
      else if (f.skill === "writing") out.push({ itemId, unitId, response: { body: "Hi Sam, thank you for your email. I would like to join the trip. I can bring food for everyone. Could you tell me the time? I hope the weather is good. Best wishes, Alex" } });
      else out.push({ itemId, unitId, response: null });
    }
  }
  return out;
}

/** Uploads a recording for every Speaking question, as the session page does after each answer. */
async function recordSpeaking(userId: string, form: Form) {
  for (const f of form.items.filter((i) => i.skill === "speaking")) {
    for (const unitId of f.units) await saveMockRecording(userId, { token: form.token, itemId: f.view.items[0].itemId, unitId, wav: Buffer.from(`wav:${unitId}`), durationMs: 20_000 });
  }
}

/** Runs the queued AI rating jobs, as the worker would. */
async function rateQueued() {
  for (const job of await db.generationJob.findMany({ where: { jobType: "mock_scoring", status: "queued" } })) await runMockScoring(job);
}

/** A full test with perfect Reading and Listening, recorded Speaking, rated by the (mocked) AI. */
async function fullTest(userId: string) {
  const form = await begin(userId);
  await recordSpeaking(userId, form);
  const submitted = await submitMockTest(userId, { token: form.token, answers: await perfectAnswers(form.items), durationSeconds: 900 });
  await rateQueued();
  return { submitted, rated: await mockResult(userId, submitted.id) };
}

beforeEach(async () => {
  await resetTestDb();
  objects.clear();
});

describe("mock test", () => {
  it("builds the test from personalised questions per the blueprint and resumes without using another credit", async () => {
    const u = await createUser("a@example.com");
    await seed(u.id);
    const form = await begin(u.id);
    for (const skill of ALL) {
      expect(form.items.filter((i) => i.skill === skill).reduce((n, i) => n + i.units.length, 0)).toBe(mockQuestionCount(skill));
    }
    expect(form.items.every((i) => i.view.items[0].source === "generated")).toBe(true);
    expect(await getCredits(u.id)).toMatchObject({ mockCredits: 0 });
    // Starting again (e.g. a reload or a second click) resumes the same test.
    expect(await startMockTest(u.id, ALL)).toEqual({ id: form.id, resumed: true });
    expect((await activeMockTest(u.id))!.items.map((i) => i.view.items[0].itemId)).toEqual(form.items.map((i) => i.view.items[0].itemId));
  });

  it("scores the started test once, with band estimates, and rejects tampering or other users", async () => {
    const u = await createUser("a@example.com");
    const other = await createUser("b@example.com");
    await seed(u.id);
    const { items, token } = await begin(u.id);
    const answers = await perfectAnswers(items);

    const result = await submitMockTest(u.id, { token, answers, durationSeconds: 900 });
    expect(result.sections.find((s) => s.skill === "reading")).toMatchObject({ band: 6 });
    expect(result.personalised).toBe(1);
    expect(result.sections.find((s) => s.skill === "writing")!.checks?.length).toBeGreaterThan(0);
    // Writing and Speaking wait for the AI rating job; so does the overall band.
    expect(result.sections.find((s) => s.skill === "speaking")).toMatchObject({ correct: null, band: null, answered: 2 });
    expect(result).toMatchObject({ scoring: "pending", estimatedBand: null, certificateCode: null });
    expect(await db.generationJob.count({ where: { jobType: "mock_scoring", userId: u.id } })).toBe(1);
    expect(await activeMockTest(u.id)).toBeNull();

    await expect(submitMockTest(u.id, { token, answers, durationSeconds: 900 })).rejects.toMatchObject({ status: 409 });
    await expect(submitMockTest(other.id, { token, answers, durationSeconds: 900 })).rejects.toMatchObject({ status: 400 });
    const [body] = token.split(".");
    await expect(submitMockTest(u.id, { token: `${body}.forged`, answers, durationSeconds: 900 })).rejects.toMatchObject({ status: 400 });
  });

  it("allows one free test for life; a Boost Pack adds two, each with new questions, and keeps a history", async () => {
    const u = await createUser("a@example.com");
    await seed(u.id);
    const first = await begin(u.id, ["reading", "listening"]);
    await submitMockTest(u.id, { token: first.token, answers: [], durationSeconds: 600 });
    await expect(startMockTest(u.id, ALL)).rejects.toMatchObject({ status: 402, code: "UPGRADE_REQUIRED" });

    await grantBoostPacks({ email: "a@example.com", packs: 1, grantedBy: "test-admin" });
    expect(await getCredits(u.id)).toMatchObject({ mockCredits: 2, planCredits: 2 });
    const second = await begin(u.id, ["reading", "listening"]);
    const ids = (f: Form) => new Set(f.items.map((i) => i.view.items[0].itemId));
    expect([...ids(second)].filter((id) => ids(first).has(id))).toEqual([]);
    await submitMockTest(u.id, { token: second.token, answers: await perfectAnswers(second.items), durationSeconds: 600 });

    const history = await mockHistory(u.id);
    expect(history).toHaveLength(2);
    expect(history[0].estimatedBand).toBe(6); // newest first
    expect(history[1].estimatedBand).toBe(1); // nothing answered
    expect(await getCredits(u.id)).toMatchObject({ mockCredits: 1 });
  });
  it("rates Writing and Speaking with AI, gives every section a band, and deletes the recordings", async () => {
    const u = await createUser("a@example.com");
    await seed(u.id);
    const form = await begin(u.id);
    const reading = form.items.find((i) => i.skill === "reading")!;
    await expect(saveMockRecording(u.id, { token: form.token, itemId: reading.view.items[0].itemId, unitId: reading.units[0], wav: Buffer.from("x"), durationMs: 1000 })).rejects.toMatchObject({ status: 400 });
    await recordSpeaking(u.id, form);
    expect(objects.size).toBe(2);
    await submitMockTest(u.id, { token: form.token, answers: await perfectAnswers(form.items), durationSeconds: 900 });
    await expect(saveMockRecording(u.id, { token: form.token, itemId: form.items.find((i) => i.skill === "speaking")!.view.items[0].itemId, unitId: "q1", wav: Buffer.from("x"), durationMs: 1000 })).rejects.toMatchObject({ status: expect.any(Number) });

    await rateQueued();
    const r = (await mockHistory(u.id))[0];
    expect(r.scoring).toBe("done");
    expect(r.sections.map((s) => [s.skill, s.band])).toEqual([["reading", 6], ["listening", 6], ["writing", 5], ["speaking", 5]]);
    expect(r.estimatedBand).toBe(5.5); // average of 6, 6, 5, 5
    expect(r.sections.find((s) => s.skill === "speaking")!.comments).toHaveLength(2);
    // Recordings and the stored email text are gone once rated; usage is recorded.
    expect(objects.size).toBe(0);
    expect(await db.mediaAsset.count({ where: { attemptId: r.id, deletedAt: null } })).toBe(0);
    expect(JSON.stringify((await db.mockTestResult.findUniqueOrThrow({ where: { id: r.id } })).sectionsJson)).not.toContain("Hi Sam");
    expect(await db.usageEvent.count({ where: { userId: u.id, eventType: "transcription" } })).toBe(2);
    // Running the job again changes nothing.
    await runMockScoring((await db.generationJob.findFirstOrThrow({ where: { jobType: "mock_scoring" } })));
    expect((await mockResult(u.id, r.id)).estimatedBand).toBe(5.5);
  });

  it("counts unrecorded Speaking answers as band 1, and lets a failed rating be retried", async () => {
    const u = await createUser("a@example.com");
    await seed(u.id);
    const form = await begin(u.id);
    const submitted = await submitMockTest(u.id, { token: form.token, answers: await perfectAnswers(form.items), durationSeconds: 900 });
    const job = await db.generationJob.findFirstOrThrow({ where: { jobType: "mock_scoring" } });
    await db.generationJob.update({ where: { id: job.id }, data: { status: "failed", attemptCount: 3 } });
    expect((await mockResult(u.id, submitted.id)).scoring).toBe("failed");
    await retryMockScoring(u.id, submitted.id);
    await rateQueued();
    const r = await mockResult(u.id, submitted.id);
    expect(r.sections.find((s) => s.skill === "speaking")!.band).toBe(1);
    expect(r.estimatedBand).toBe(4.5); // average of 6, 6, 5, 1
    await expect(retryMockScoring(u.id, submitted.id)).rejects.toMatchObject({ status: 409 });
  });

  it("issues a verifiable certificate for a high score, once, as a snapshot", async () => {
    const u = await createUser("a@example.com");
    await seed(u.id);
    const { submitted, rated: result } = await fullTest(u.id);
    expect(submitted.certificateCode).toBeNull(); // not before Writing and Speaking are rated
    expect(result.certificateCode).toMatch(/^LT-\w{4}-\w{4}-\w{4}$/);

    const cert = (await findCertificate(result.certificateCode!.toLowerCase().replace(/-/g, " ")))!;
    expect(cert).toMatchObject({ code: result.certificateCode, holderName: "a", overallBand: 5.5, revokedAt: null });
    expect(cert.sections.map((s) => s.band)).toEqual([6, 6, 5, 5]);
    expect(cert.sections.map((s) => s.skill)).toEqual(ALL);
    expect((await mockHistory(u.id))[0].certificateCode).toBe(cert.code);

    // Asking again returns the same certificate; a later name change does not alter it.
    await db.user.update({ where: { id: u.id }, data: { displayName: "Someone Else" } });
    expect((await issueCertificate(u.id, await mockResult(u.id, result.id))).code).toBe(cert.code);
    expect((await findCertificate(cert.code))!.holderName).toBe("a");
    expect(await db.certificate.count()).toBe(1);

    // Another learner cannot claim it, and unknown IDs are not found.
    const other = await createUser("b@example.com");
    await expect(mockResult(other.id, result.id)).rejects.toMatchObject({ status: 404 });
    expect(await findCertificate("LT-0000-0000-0000")).toBeNull();
  });

  it("gives no certificate for a low score", async () => {
    const u = await createUser("a@example.com");
    await seed(u.id);
    const { token } = await begin(u.id);
    const result = await submitMockTest(u.id, { token, answers: [], durationSeconds: 600 });
    await expect(issueCertificate(u.id, result)).rejects.toMatchObject({ status: 409 });
    await rateQueued();
    const rated = await mockResult(u.id, result.id);
    expect(rated).toMatchObject({ scoring: "done", estimatedBand: 1, certificateCode: null });
    expect(await db.certificate.count()).toBe(0);
  });
});
