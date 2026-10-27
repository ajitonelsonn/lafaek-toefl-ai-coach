import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { MOCK_BLUEPRINT, mockQuestionCount } from "@/lib/config/mock-test";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import { db } from "@/lib/server/db";
import { getCredits, grantBoostPacks } from "@/lib/server/credits";
import { activeMockTest, mockHistory, startMockTest, submitMockTest } from "@/lib/server/mock-test";
import { createUser, resetTestDb } from "../support/db";
import { fakeItems } from "../support/items";

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

beforeEach(async () => {
  await resetTestDb();
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
    expect(result.estimatedBand).toBe(6);
    expect(result.personalised).toBe(1);
    expect(result.sections.find((s) => s.skill === "writing")!.checks?.length).toBeGreaterThan(0);
    expect(result.sections.find((s) => s.skill === "speaking")).toMatchObject({ correct: null, band: null, answered: 2 });
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
});
