import { json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { retryFailedTasks } from "@/lib/server/generation/queue";
import { getBatchStatus } from "@/lib/server/generation/status";

// Resumes failed task packs (at most 2 learner retries per task). Never regenerates finished items.
export const POST = route<{ batchId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const batchId = validate(uuidParam, params.batchId);
  await rateLimit("generation-retry", user.id, 5, 3600);
  const requeued = await retryFailedTasks(user.id, batchId, user.role === "admin");
  return json({ requeued, batch: await getBatchStatus(user.id, batchId) });
});
