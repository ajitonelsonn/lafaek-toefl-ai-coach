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

/** One bounded pass: housekeeping, then claim and process up to `concurrency` jobs. */
export async function tick(owner: string, concurrency = 3, jobTypes?: JobType[]): Promise<number> {
  await recoverExpiredLeases();
  if (features.storage()) await unblockJobs(["asset_audio", "asset_image", "delete_user_assets"]);
  const jobs = await claimJobs(owner, concurrency, jobTypes);
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
