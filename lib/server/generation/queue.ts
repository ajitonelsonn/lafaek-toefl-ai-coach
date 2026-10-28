import "server-only";
import { Prisma, type GenerationJob, type JobStatus, type JobType } from "@prisma/client";
import { PRACTICE_TYPES } from "@/lib/config/practice-types";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http";

// Durable PostgreSQL job queue. State lives in generation_jobs; workers claim due
// jobs with FOR UPDATE SKIP LOCKED and hold a lease they must renew. A crashed
// worker's lease expires and the job becomes due again.

const ACTIVE: JobStatus[] = ["running", "validating", "storing"];
export const ALL_JOB_TYPES: JobType[] = ["task_pack", "asset_image", "asset_audio", "reconcile_media", "delete_user_assets", "vocabulary_pack", "study_schedule"];
/** Job types that call Meta (text generation, vocabulary, study schedules and images). */
export const META_JOB_TYPES: JobType[] = ["task_pack", "asset_image", "vocabulary_pack", "study_schedule"];
export const leaseMs = () => env().GENERATION_TIMEOUT_SECONDS * 1000 * 3;
/** Task packs that take longest (batched AI calls); a new batch claims them first, slowest first. */
const SLOW_FIRST = ["build-sentence", "listen-choose-response"];

/**
 * Creates the batch for the user's active plan version once; repeated calls return it.
 * Each saved plan uses a lifetime study-plan credit (lib/server/credits.ts), which also bounds generation.
 */
export async function startInitialBatch(userId: string, idempotencyKey: string) {
  const plan = await db.studyPlan.findFirst({ where: { userId, status: "active" } });
  if (!plan) throw new ApiError(409, "CONFLICT", "Create your study plan first.");

  const sameKey = await db.generationBatch.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
  if (sameKey) return sameKey;
  const existing = await db.generationBatch.findFirst({ where: { userId, planVersion: plan.version } });
  if (existing) return existing;

  const perTask = env().GENERATION_ITEMS_PER_TASK ?? Number.POSITIVE_INFINITY;
  // The slowest packs are claimed first, so they run alongside the quick ones instead of after them.
  const now = Date.now();
  const startAt = (slug: string) => {
    const i = SLOW_FIRST.indexOf(slug);
    return new Date(i < 0 ? now : now - (SLOW_FIRST.length - i) * 1000);
  };
  try {
    return await db.$transaction(async (tx) => {
      const batch = await tx.generationBatch.create({
        data: { userId, studyPlanId: plan.id, planVersion: plan.version, idempotencyKey, status: "queued", totalTasks: PRACTICE_TYPES.length },
      });
      await tx.generationJob.createMany({
        data: PRACTICE_TYPES.map((t) => ({
          batchId: batch.id,
          userId,
          taskSlug: t.slug,
          jobType: "task_pack" as const,
          idempotencyKey: `${batch.id}:task_pack:${t.slug}`,
          payloadJson: { studyPlanId: plan.id, items: Math.min(perTask, t.referenceCount) },
          progressTotal: Math.min(perTask, t.referenceCount),
          maxAttempts: env().GENERATION_MAX_RETRIES,
          nextAttemptAt: startAt(t.slug),
        })),
      });
      return batch;
    });
  } catch (e) {
    // A concurrent request created it first (unique constraint): return that one.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const batch = await db.generationBatch.findFirst({ where: { userId, planVersion: plan.version } });
      if (batch) return batch;
    }
    throw e;
  }
}

/** Enqueues a job once (keyed by idempotencyKey). */
export async function enqueueJob(data: {
  idempotencyKey: string;
  jobType: JobType;
  userId: string | null;
  batchId?: string | null;
  taskSlug?: string | null;
  payload: Record<string, unknown>;
  progressTotal?: number;
  blocked?: boolean;
}): Promise<void> {
  await db.generationJob
    .create({
      data: {
        idempotencyKey: data.idempotencyKey,
        jobType: data.jobType,
        userId: data.userId,
        batchId: data.batchId ?? null,
        taskSlug: data.taskSlug ?? null,
        payloadJson: data.payload as Prisma.InputJsonValue,
        progressTotal: data.progressTotal ?? 1,
        maxAttempts: env().GENERATION_MAX_RETRIES,
        status: data.blocked ? "blocked_configuration" : "queued",
        errorCode: data.blocked ? "CONFIGURATION_MISSING" : null,
        errorSummary: data.blocked ? "Storage (S3_BUCKET) is not configured." : null,
      },
    })
    .catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
      throw e;
    });
}

/**
 * Atomically claims up to `limit` due jobs for this worker, never giving one user
 * more than GENERATION_MAX_CONCURRENCY_PER_USER running jobs. Claims are serialised
 * with a transaction-scoped advisory lock so concurrent workers cannot both see
 * the same free slot. `jobTypes` limits what this worker takes (e.g. a worker that
 * cannot reach Meta leaves Meta jobs for one that can).
 */
export async function claimJobs(workerId: string, limit: number, jobTypes: JobType[] = ALL_JOB_TYPES): Promise<GenerationJob[]> {
  const perUser = env().GENERATION_MAX_CONCURRENCY_PER_USER;
  const leaseUntil = new Date(Date.now() + leaseMs());
  const types = jobTypes.join(",");
  const ids = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(724811)`;
    return tx.$queryRaw<{ id: string }[]>`
      WITH running AS (
        SELECT user_id, count(*)::int AS n FROM generation_jobs
        WHERE status IN ('running', 'validating', 'storing') AND lease_expires_at > now() AND user_id IS NOT NULL
        GROUP BY user_id
      ),
      candidates AS (
        SELECT j.id, j.user_id, j.next_attempt_at, j.created_at,
               row_number() OVER (PARTITION BY j.user_id ORDER BY j.next_attempt_at, j.created_at) AS rn
        FROM generation_jobs j
        WHERE j.status IN ('queued', 'retry_wait') AND j.next_attempt_at <= now()
          AND j.job_type::text = ANY(string_to_array(${types}, ','))
      ),
      eligible AS (
        SELECT c.id FROM candidates c LEFT JOIN running r ON r.user_id = c.user_id
        WHERE c.user_id IS NULL OR c.rn <= ${perUser} - COALESCE(r.n, 0)
        ORDER BY c.next_attempt_at, c.created_at
        LIMIT ${limit}
      )
      UPDATE generation_jobs g
      SET status = 'running', lease_owner = ${workerId}, lease_expires_at = ${leaseUntil},
          attempt_count = g.attempt_count + 1, started_at = COALESCE(g.started_at, now()), updated_at = now()
      FROM eligible WHERE g.id = eligible.id
      RETURNING g.id`;
  }, { maxWait: 15_000, timeout: 30_000 });
  if (!ids.length) return [];
  await db.generationBatch.updateMany({
    where: { jobs: { some: { id: { in: ids.map((r) => r.id) } } }, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  return db.generationJob.findMany({ where: { id: { in: ids.map((r) => r.id) } } });
}

/** Extends the lease; returns false if this worker no longer owns the job. */
export async function heartbeat(jobId: string, workerId: string): Promise<boolean> {
  const r = await db.generationJob.updateMany({
    where: { id: jobId, leaseOwner: workerId, status: { in: ACTIVE } },
    data: { leaseExpiresAt: new Date(Date.now() + leaseMs()) },
  });
  return r.count === 1;
}

export async function setStage(jobId: string, workerId: string, status: "validating" | "storing" | "running", progressDone?: number) {
  await db.generationJob.updateMany({ where: { id: jobId, leaseOwner: workerId }, data: { status, ...(progressDone !== undefined ? { progressDone } : {}) } });
}

export async function completeJob(job: GenerationJob, workerId: string, extra: Partial<Pick<GenerationJob, "provider" | "modelId" | "promptVersion" | "providerRequestId">> = {}) {
  await db.generationJob.updateMany({
    where: { id: job.id, leaseOwner: workerId },
    data: { status: "completed", finishedAt: new Date(), leaseExpiresAt: null, leaseOwner: null, errorCode: null, errorSummary: null, progressDone: job.progressTotal, ...extra },
  });
  if (job.batchId) await refreshBatch(job.batchId);
}

/** Records a failure: retry with backoff while attempts remain, else fail (or block on configuration). */
export async function failJob(job: GenerationJob, workerId: string, err: { code: string; summary: string; retryable: boolean; blocked?: boolean }) {
  const exhausted = job.attemptCount >= job.maxAttempts;
  const status: JobStatus = err.blocked ? "blocked_configuration" : err.retryable && !exhausted ? "retry_wait" : "failed";
  const backoffMs = Math.min(15 * 60_000, 30_000 * 2 ** (job.attemptCount - 1)) + Math.floor(Math.random() * 5000);
  await db.generationJob.updateMany({
    where: { id: job.id, leaseOwner: workerId },
    data: {
      status,
      errorCode: err.code.slice(0, 60),
      errorSummary: err.summary.slice(0, 300),
      nextAttemptAt: new Date(Date.now() + backoffMs),
      leaseExpiresAt: null,
      leaseOwner: null,
      finishedAt: status === "retry_wait" ? null : new Date(),
    },
  });
  if (job.batchId) await refreshBatch(job.batchId);
}

/** Jobs whose worker died: make them due again (or fail when out of attempts). */
export async function recoverExpiredLeases(): Promise<number> {
  const expired = await db.generationJob.findMany({ where: { status: { in: ACTIVE }, leaseExpiresAt: { lt: new Date() } } });
  for (const j of expired) {
    const out = j.attemptCount >= j.maxAttempts;
    await db.generationJob.updateMany({
      where: { id: j.id, status: { in: ACTIVE }, leaseExpiresAt: { lt: new Date() } },
      data: { status: out ? "failed" : "retry_wait", leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: new Date(), errorCode: "LEASE_EXPIRED", errorSummary: "The worker stopped before finishing; the job was recovered." },
    });
    if (j.batchId) await refreshBatch(j.batchId);
  }
  return expired.length;
}

/**
 * Re-queues jobs blocked with `errorCode`. Housekeeping does this for missing storage once it
 * exists; PROVIDER_CONFIG jobs are re-queued only at worker start (settings change → restart),
 * so a still-wrong setting blocks them again once instead of looping.
 */
export async function unblockJobs(jobTypes: JobType[], errorCode = "CONFIGURATION_MISSING"): Promise<number> {
  const r = await db.generationJob.updateMany({
    where: { status: "blocked_configuration", jobType: { in: jobTypes }, errorCode },
    data: { status: "queued", nextAttemptAt: new Date(), errorCode: null, errorSummary: null, attemptCount: 0 },
  });
  return r.count;
}

/** Recomputes batch counters and status from its task jobs (source of truth: PostgreSQL). */
export async function refreshBatch(batchId: string) {
  const jobs = await db.generationJob.findMany({ where: { batchId, jobType: "task_pack" }, select: { status: true } });
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed" || j.status === "cancelled").length;
  const done = completed + failed === jobs.length;
  await db.generationBatch.update({
    where: { id: batchId },
    data: {
      completedTasks: completed,
      failedTasks: failed,
      status: !done ? "running" : failed === 0 ? "completed" : completed === 0 ? "failed" : "partial",
      completedAt: done ? new Date() : null,
    },
  });
}

/** Owner-initiated retry of failed task jobs. Resumes; never regenerates finished items. */
export async function retryFailedTasks(userId: string, batchId: string, isAdmin: boolean): Promise<number> {
  const batch = await db.generationBatch.findFirst({ where: { id: batchId, ...(isAdmin ? {} : { userId }) } });
  if (!batch) throw new ApiError(404, "NOT_FOUND", "This generation batch was not found.");
  const failed = await db.generationJob.findMany({ where: { batchId, status: "failed" } });
  let n = 0;
  for (const j of failed) {
    const payload = j.payloadJson as { userRetries?: number };
    const userRetries = payload.userRetries ?? 0;
    if (!isAdmin && userRetries >= 2) continue;
    await db.generationJob.update({
      where: { id: j.id },
      data: { status: "queued", attemptCount: 0, nextAttemptAt: new Date(), errorCode: null, errorSummary: null, finishedAt: null, payloadJson: { ...(j.payloadJson as object), userRetries: userRetries + (isAdmin ? 0 : 1) } },
    });
    n++;
  }
  if (n) await db.generationBatch.update({ where: { id: batchId }, data: { status: "running", completedAt: null } });
  return n;
}
