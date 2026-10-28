import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { FEEDBACK_LABEL, FEEDBACK_VERSION, coachResponse } from "@/lib/server/feedback";
import { getPracticeSet, submitResponses } from "@/lib/server/practice";
import { getProgress } from "@/lib/server/insights";
import { createUser, resetTestDb } from "../support/db";
import { bySlug } from "../support/items";

// The AI returns a band of 4.3 and short coaching.
vi.mock("@/lib/server/providers/meta", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/providers/meta")>()),
  generateText: vi.fn(async () => ({
    data: { band: 4.3, summary: "Clear email with all three points.", strengths: ["Polite opening"], improvements: ["Add one more detail"], dimensions: [{ dimension: "Covers every point", comment: "All three are there." }, { dimension: "Grammar", comment: "Mostly accurate." }, { dimension: "Tone", comment: "Polite." }], improvedSentence: null },
    usage: { inputTokens: 100, outputTokens: 50 },
    model: "test-model",
    requestId: null,
  })),
}));

beforeEach(async () => {
  await resetTestDb();
});

const BODY = "Dear Ms. Lane, I am writing about the hiking trip on Saturday. I would like to join, and I can bring snacks for the group. Could you tell me what time we will meet? Best wishes, Alex";

/** Stores a rating as the feedback route does. */
async function rate(userId: string, itemId: string, band: number) {
  const feedback = { ...(await coachResponse({ userId, attemptKey: `${itemId}:${band}`, kind: "writing", taskTitle: "Write an Email", prompt: "task", response: BODY, dimensions: ["Covers every point"] })), band };
  await db.practiceAttempt.create({
    data: { userId, practiceItemId: itemId, taskSlug: "write-email", unitId: "w", responseJson: { kind: "ai_feedback_request", words: 40 }, scoreJson: { correct: null, band }, feedbackJson: { ai: feedback, label: FEEDBACK_LABEL }, scoringVersion: FEEDBACK_VERSION },
  });
}

describe("AI score for open answers", () => {
  it("rounds the AI band to the 1–6 scale, restores the latest score with the answer, and averages scores per skill", async () => {
    const u = await createUser("a@example.com");
    expect((await coachResponse({ userId: u.id, attemptKey: "k", kind: "writing", taskTitle: "Write an Email", prompt: "task", response: BODY, dimensions: ["Covers every point"] })).band).toBe(4.5);

    const created = [];
    for (const [n, fake] of bySlug("write-email").slice(0, 2).entries()) {
      const { media: _m, ...rest } = fake;
      void _m;
      created.push(await db.practiceItem.create({ data: { ...(rest as Prisma.PracticeItemUncheckedCreateInput), userId: u.id, source: "generated", contentKey: `ai-score-test:${n}` } }));
    }
    const [first, second] = created;
    await submitResponses(u.id, first.id, [{ unitId: "w", response: { body: BODY } }], 60_000);
    await rate(u.id, first.id, 3.5);
    await rate(u.id, first.id, 5); // a re-check after editing: the latest score counts
    await submitResponses(u.id, second.id, [{ unitId: "w", response: { body: BODY } }], 60_000);
    await rate(u.id, second.id, 4);

    const set = await getPracticeSet(u.id, "write-email");
    expect(set.progress.results[`${first.id}:w`].ai).toMatchObject({ feedback: { band: 5 }, label: FEEDBACK_LABEL });
    expect(set.progress.results[`${second.id}:w`].ai?.feedback.band).toBe(4);

    const writing = (await getProgress(u.id)).bySkill.find((s) => s.skill === "writing")!;
    expect(writing).toMatchObject({ aiBand: 4.5, aiRated: 2 }); // (5 + 4) / 2
  });
});
