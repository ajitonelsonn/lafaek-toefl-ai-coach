import { z } from "zod";
import { db } from "@/lib/server/db";
import { ApiError, json, parseBody, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { getOwnedItem } from "@/lib/server/practice";
import { FEEDBACK_LABEL, FEEDBACK_VERSION, coachResponse } from "@/lib/server/feedback";
import { ProviderError } from "@/lib/server/providers/http";
import { getPracticeType, type PracticeSlug } from "@/lib/config/practice-types";
import { rubricFor } from "@/lib/server/content/schemas";

const body = z.object({ unitId: z.string().regex(/^[a-z]\d{0,2}$/), text: z.string().trim().min(20, "Write a little more first.").max(8000) });

// A rating takes about 10–15 s with low model reasoning (measured); the limit leaves room for slow calls.
export const maxDuration = 60;

// AI score (band 1–6) and coaching for an email, discussion post or interview answer. Requested by the
// practice page after each checked or transcribed answer; rate-limited per user.
export const POST = route<{ itemId: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  const item = await getOwnedItem(user.id, validate(uuidParam, params.itemId));
  const slug = item.taskSlug as PracticeSlug;
  if (!["write-email", "academic-discussion", "take-interview"].includes(slug)) throw new ApiError(400, "VALIDATION_ERROR", "AI scores are available for emails, discussion posts and interview answers.");
  const input = await parseBody(req, body, 24 * 1024);
  await rateLimit("ai-feedback", user.id, 40, 3600);
  await rateLimit("ai-feedback-day", user.id, 150, 86400);

  const c = item.contentJson as Record<string, unknown>;
  const prompt =
    slug === "write-email"
      ? `${c.scenario}\nThe email must: ${(c.bullets as string[]).join(" ")}`
      : slug === "academic-discussion"
        ? `${(c.professor as { prompt: string }).prompt}\nClassmates: ${(c.students as { name: string; text: string }[]).map((s) => `${s.name}: ${s.text}`).join("\n")}`
        : `${c.scenario}\nQuestion: ${((c.questions as { id: string; text: string }[]).find((q) => q.id === input.unitId) ?? { text: "" }).text}`;
  const rubric = rubricFor(slug).dimensions;

  let feedback;
  try {
    feedback = await coachResponse({ userId: user.id, attemptKey: `${item.id}:${user.id}:${Date.now()}`, kind: slug === "take-interview" ? "speaking" : "writing", taskTitle: getPracticeType(slug)!.title, prompt, response: input.text, dimensions: rubric });
  } catch (e) {
    if (e instanceof ProviderError) throw new ApiError(502, "PROVIDER_ERROR", "The AI score is not available right now. Please try again.");
    throw e;
  }
  await db.practiceAttempt.create({
    data: { userId: user.id, practiceItemId: item.id, taskSlug: slug, unitId: input.unitId, responseJson: { kind: "ai_feedback_request", words: input.text.split(/\s+/).length }, scoreJson: { correct: null, band: feedback.band }, feedbackJson: { ai: feedback, label: FEEDBACK_LABEL }, scoringVersion: FEEDBACK_VERSION },
  });
  return json({ feedback, label: FEEDBACK_LABEL });
});
