import "server-only";
import { z } from "zod";
import { generateText } from "./providers/meta";
import { recordUsage } from "./usage";
import { RATING_CRITERIA, toHalf } from "./rating-criteria";

// AI score and coaching for open-ended responses (email, discussion post, interview answer): a band on
// the TOEFL 2026 scale, judged like the mock test, plus coaching. Always labelled as a practice estimate.
export const FEEDBACK_VERSION = "ai-feedback-1";
export const FEEDBACK_LABEL = "AI score and coaching — a practice estimate, not an official TOEFL score.";

export const feedbackSchema = z.strictObject({
  band: z.number().min(1).max(6),
  summary: z.string().min(10).max(400),
  strengths: z.array(z.string().min(3).max(200)).min(1).max(3),
  improvements: z.array(z.string().min(3).max(200)).min(1).max(4),
  dimensions: z.array(z.strictObject({ dimension: z.string().min(2).max(40), comment: z.string().min(5).max(240) })).min(3).max(6),
  improvedSentence: z.string().max(300).nullable(),
});

export type Feedback = z.infer<typeof feedbackSchema>;

export async function coachResponse(args: {
  userId: string;
  attemptKey: string;
  kind: "writing" | "speaking";
  taskTitle: string;
  prompt: string;
  response: string;
  dimensions: string[];
}): Promise<Feedback> {
  const r = await generateText({
    task: args.kind === "writing" ? "feedback:writing" : "feedback:speaking",
    schema: feedbackSchema,
    temperature: 0.2,
    // Fast enough for a request on Vercel (60 s limit); measured before switching it on.
    reasoningEffort: "low",
    timeoutSeconds: 50,
    system: `${RATING_CRITERIA[args.kind]}
Put the band in "band". Then coach the learner as a supportive teacher: short, specific, encouraging feedback in simple English (B1 level), using these rubric dimensions: ${args.dimensions.join(", ")}. Never claim the band is an official TOEFL score. Quote at most one short phrase from the learner. Return JSON only.`,
    user: `Task: ${args.taskTitle}\nPrompt given to the learner:\n${args.prompt.slice(0, 2500)}\n\nLearner's ${args.kind === "writing" ? "response" : "spoken response (automatic transcript, may contain recognition errors)"}:\n${args.response.slice(0, 6000)}`,
  });
  await recordUsage({
    idempotencyKey: `meta:${r.requestId ?? args.attemptKey}`,
    userId: args.userId,
    eventType: "text_feedback",
    provider: "meta",
    modelId: r.model,
    inputUnits: r.usage.inputTokens,
    outputUnits: r.usage.outputTokens,
  });
  return { ...r.data, band: toHalf(r.data.band) };
}
