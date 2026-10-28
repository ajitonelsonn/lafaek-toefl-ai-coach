import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { retryMockScoring } from "@/lib/server/mock-test";

const body = z.object({ resultId: z.string().uuid() });

/** Queues the AI rating of Writing and Speaking again after it failed. */
export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const { resultId } = await parseBody(req, body, 1024);
  await rateLimit("mock-rescore", user.id, 10, 3600);
  await retryMockScoring(user.id, resultId);
  return json({ queued: true }, { status: 202 });
});
