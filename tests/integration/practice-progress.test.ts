import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { getPracticeSet, resetPractice, submitResponses } from "@/lib/server/practice";
import { getProgress } from "@/lib/server/insights";
import { createUser, resetTestDb } from "../support/db";
import { bySlug } from "../support/items";

beforeEach(async () => {
  await resetTestDb();
});

describe("practice continues where the learner stopped", () => {
  it("restores answers after reload, counts them as done, and Start over clears them but keeps the history", async () => {
    const u = await createUser("a@example.com");
    const { media: _m, ...fake } = bySlug("read-in-daily-life")[0];
    void _m;
    const item = await db.practiceItem.create({ data: { ...(fake as Prisma.PracticeItemUncheckedCreateInput), userId: u.id, source: "generated", contentKey: "progress-test:1" } });
    const key = (item.answerKeyJson as Record<string, string>).q1;

    await submitResponses(u.id, item.id, [{ unitId: "q1", response: key }], 1000);

    // Reloading the page: the answer and its result come back, so the session opens at the next question.
    const set = await getPracticeSet(u.id, "read-in-daily-life");
    expect(set.progress.answers[`${item.id}:q1`]).toBe(key);
    expect(set.progress.results[`${item.id}:q1`]).toMatchObject({ correct: true });
    expect(Object.keys(set.progress.results)).toHaveLength(1);
    const before = (await getProgress(u.id)).byTask.find((t) => t.slug === "read-in-daily-life")!;
    expect(before).toMatchObject({ doneUnits: 1, attemptedUnits: 1 });

    // Start over: nothing counts as done on the practice page, but the history is kept.
    await resetPractice(u.id, "read-in-daily-life");
    expect((await getPracticeSet(u.id, "read-in-daily-life")).progress).toEqual({ answers: {}, results: {} });
    const after = (await getProgress(u.id)).byTask.find((t) => t.slug === "read-in-daily-life")!;
    expect(after).toMatchObject({ doneUnits: 0, attemptedUnits: 1 });
  });
});
