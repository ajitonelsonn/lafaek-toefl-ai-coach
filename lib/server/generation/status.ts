import "server-only";
import type { JobStatus } from "@prisma/client";
import { PRACTICE_TYPES, type PracticeSlug } from "@/lib/config/practice-types";
import type { GenerationBatchDTO, GenerationStateDTO } from "@/lib/practice/generation-dto";
import { db } from "../db";

const STATE: Record<JobStatus, GenerationStateDTO> = {
  queued: "queued",
  retry_wait: "queued",
  running: "generating",
  validating: "generating",
  storing: "generating",
  completed: "ready",
  failed: "failed",
  cancelled: "failed",
  blocked_configuration: "blocked",
};

/** Learner-friendly messages; internal error details are never sent to the browser. */
function messageFor(status: JobStatus, code: string | null): string | null {
  if (status === "retry_wait") return code === "DAILY_LIMIT" ? "Daily limit reached — continues tomorrow." : "Retrying shortly.";
  if (status === "failed") return "Some content could not be generated.";
  if (status === "blocked_configuration") return code === "PROVIDER_CONFIG" ? "Waiting for AI service setup." : "Waiting for storage setup.";
  return null;
}

function combine(states: GenerationStateDTO[]): GenerationStateDTO | null {
  if (!states.length) return null;
  for (const s of ["generating", "queued", "failed", "blocked"] as GenerationStateDTO[]) if (states.includes(s)) return s;
  return "ready";
}

export async function getBatchStatus(userId: string, batchId?: string): Promise<GenerationBatchDTO | null> {
  const batch = await db.generationBatch.findFirst({ where: { userId, ...(batchId ? { id: batchId } : {}) }, orderBy: { createdAt: "desc" } });
  if (!batch) return null;
  const [taskJobs, assetJobs, readyCounts] = await Promise.all([
    db.generationJob.findMany({ where: { batchId: batch.id, jobType: "task_pack" } }),
    db.generationJob.findMany({ where: { userId, jobType: { in: ["asset_audio", "asset_image"] } }, select: { taskSlug: true, jobType: true, status: true } }),
    db.practiceItem.groupBy({ by: ["taskSlug"], where: { userId, studyPlanId: batch.studyPlanId, validationStatus: "valid" }, _count: { _all: true } }),
  ]);
  return {
    id: batch.id,
    status: batch.status,
    totalTasks: batch.totalTasks,
    completedTasks: batch.completedTasks,
    failedTasks: batch.failedTasks,
    createdAt: batch.createdAt.toISOString(),
    tasks: PRACTICE_TYPES.map((t) => {
      const job = taskJobs.find((j) => j.taskSlug === t.slug);
      const assets = assetJobs.filter((a) => a.taskSlug === t.slug);
      return {
        slug: t.slug as PracticeSlug,
        state: job ? STATE[job.status] : "not_started",
        itemsReady: readyCounts.find((r) => r.taskSlug === t.slug)?._count._all ?? 0,
        itemsTotal: job?.progressTotal ?? 0,
        updatedAt: (job?.updatedAt ?? batch.updatedAt).toISOString(),
        message: job ? messageFor(job.status, job.errorCode) : null,
        canRetry: job?.status === "failed" && ((job.payloadJson as { userRetries?: number }).userRetries ?? 0) < 2,
        media: {
          audio: combine(assets.filter((a) => a.jobType === "asset_audio").map((a) => STATE[a.status])),
          image: combine(assets.filter((a) => a.jobType === "asset_image").map((a) => STATE[a.status])),
        },
      };
    }),
  };
}
