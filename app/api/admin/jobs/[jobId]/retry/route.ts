import { db } from "@/lib/server/db";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth/session";
import { refreshBatch } from "@/lib/server/generation/queue";

// Deliberate, audited admin retry of one failed job.
export const POST = route<{ jobId: string }>(async (_req, { params }) => {
  const { user } = await requireAdmin();
  const job = await db.generationJob.findUnique({ where: { id: validate(uuidParam, params.jobId) } });
  if (!job || !["failed", "blocked_configuration", "cancelled"].includes(job.status)) throw new ApiError(404, "NOT_FOUND", "No retryable job found.");
  await db.$transaction([
    db.generationJob.update({ where: { id: job.id }, data: { status: "queued", attemptCount: 0, nextAttemptAt: new Date(), errorCode: null, errorSummary: null, finishedAt: null } }),
    db.adminAuditEvent.create({ data: { adminUserId: user.id, action: "job.retry", targetType: "generation_job", targetId: job.id, safeMetadataJson: { jobType: job.jobType, previousStatus: job.status } } }),
  ]);
  if (job.batchId) await refreshBatch(job.batchId);
  return json({ status: "queued" });
});
