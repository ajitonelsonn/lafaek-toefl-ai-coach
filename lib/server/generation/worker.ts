import "server-only";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { GenerationJob, JobType } from "@prisma/client";
import { features } from "../env";
import { log } from "../log";
import { pruneRateLimits } from "../rate-limit";
import { claimJobs, completeJob, failJob, heartbeat, recoverExpiredLeases, unblockJobs } from "./queue";
import { JobFailure, reconcileMedia, runAudioAsset, runDeleteUserAssets, runImageAsset, runTaskPack, toJobFailure } from "./handlers";
import { backfillVocabularyJobs, queueVocabularyFor, runVocabularyPack } from "./vocabulary";
import { runStudySchedule } from "./study-schedule";
import { runMockScoring } from "../mock-scoring";

export const workerId = () => `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

export async function processJob(job: GenerationJob, owner: string): Promise<void> {
  const started = Date.now();
  // Keep the lease alive while a long provider call is running.
  const beat = setInterval(() => void heartbeat(job.id, owner).catch(() => undefined), 20_000);
  try {
    switch (job.jobType) {
      case "task_pack":
        await runTaskPack(job, owner);
        break;
      case "asset_audio":
        await runAudioAsset(job, owner);
        break;
      case "asset_image":
        await runImageAsset(job, owner);
        break;
      case "delete_user_assets":
        await runDeleteUserAssets(job);
        break;
      case "reconcile_media":
        await reconcileMedia();
        break;
      case "vocabulary_pack":
        await runVocabularyPack(job);
        break;
      case "study_schedule":
        await runStudySchedule(job);
        break;
      case "mock_scoring":
        await runMockScoring(job);
        break;
    }
    await completeJob(job, owner, job.jobType === "task_pack" ? { provider: "meta" } : {});
    // A finished pack feeds the learner's vocabulary list (housekeeping back-fills if this fails).
    if (job.jobType === "task_pack") await queueVocabularyFor(job).catch(() => undefined);
    log.info("job completed", { jobId: job.id, jobType: job.jobType, taskSlug: job.taskSlug, attempt: job.attemptCount, ms: Date.now() - started });
  } catch (err) {
    const f: JobFailure = toJobFailure(err);
    await failJob(job, owner, { code: f.code, summary: f.message, retryable: f.retryable, blocked: f.blocked });
    log.warn("job failed", { jobId: job.id, jobType: job.jobType, taskSlug: job.taskSlug, attempt: job.attemptCount, code: f.code, retryable: f.retryable, blocked: f.blocked, summary: f.message });
  } finally {
    clearInterval(beat);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function claimNext(owner: string, limit: number, jobTypes?: JobType[], perUser?: number): Promise<GenerationJob[]> {
  await recoverExpiredLeases();
  if (features.storage()) await unblockJobs(["asset_audio", "asset_image", "delete_user_assets"]);
  return claimJobs(owner, limit, jobTypes, perUser);
}

/**
 * The long-running worker: keeps up to `concurrency` jobs running and claims the next one as soon
 * as any job finishes, so one long pack (e.g. Build a Sentence) never holds up the others.
 * `beforeClaim` runs before each claim (housekeeping); returns when `stopping()` is true and all
 * running jobs have finished, or with `once` when there is nothing left to do.
 */
export async function runPool(
  owner: string,
  concurrency: number,
  opts: { jobTypes: () => JobType[]; stopping: () => boolean; beforeClaim?: () => Promise<void>; once?: boolean; perUser?: number },
): Promise<void> {
  const running = new Set<Promise<void>>();
  while (!opts.stopping()) {
    let claimed = 0;
    try {
      await opts.beforeClaim?.();
      const free = concurrency - running.size;
      const jobs = free > 0 ? await claimNext(owner, free, opts.jobTypes(), opts.perUser) : [];
      for (const job of jobs) {
        const p: Promise<void> = processJob(job, owner)
          .catch((e) => log.error("job crashed", { jobId: job.id, error: e instanceof Error ? e.message.slice(0, 200) : "unknown" }))
          .finally(() => running.delete(p));
        running.add(p);
      }
      claimed = jobs.length;
    } catch (e) {
      log.error("worker loop error", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
      await Promise.race([sleep(5000), ...running]);
      continue;
    }
    if (opts.once && !claimed && !running.size) break;
    // All slots busy: wait for one to free. Nothing to claim: look again in 3 s (or when a job ends).
    if (running.size >= concurrency) await Promise.race(running);
    else if (!claimed) await Promise.race([sleep(3000), ...running]);
  }
  await Promise.allSettled(running);
}

/** One bounded pass (tests and scripts): claim up to `concurrency` jobs and wait for all of them. */
export async function tick(owner: string, concurrency = 3, jobTypes?: JobType[]): Promise<number> {
  const jobs = await claimNext(owner, concurrency, jobTypes);
  await Promise.all(jobs.map((j) => processJob(j, owner)));
  return jobs.length;
}

export async function housekeeping() {
  await pruneRateLimits().catch(() => undefined);
  const r = await reconcileMedia().catch(() => ({ attached: 0, failed: 0 }));
  if (r.attached || r.failed) log.info("media reconciled", r);
  const vocab = await backfillVocabularyJobs().catch(() => 0);
  if (vocab) log.info("vocabulary jobs queued for finished packs", { count: vocab });
}
