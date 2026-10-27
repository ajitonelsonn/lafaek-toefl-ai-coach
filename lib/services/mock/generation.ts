// Simulated content-generation jobs. No AI service is called; progress is
// advanced on a timer in the browser so the status UI can be demonstrated.
import { PRACTICE_TYPES } from "@/lib/config/practice-types";
import type { GenerationJob } from "@/lib/services/types";

/** One job is set to fail part-way so the retry state can be seen. */
const FAILS_ONCE = "take-interview";

export function createInitialJobs(now = new Date()): GenerationJob[] {
  return PRACTICE_TYPES.map((t) => ({
    id: `job-${t.slug}`,
    slug: t.slug,
    state: "queued",
    progress: 0,
    itemsReady: 0,
    itemsTotal: Math.min(t.referenceCount, 10),
    updatedAt: now.toISOString(),
  }));
}

const MAX_PARALLEL = 3;

/** Advances jobs by one tick. Pure: returns a new array. */
export function stepJobs(jobs: GenerationJob[], now = new Date()): GenerationJob[] {
  const stamp = now.toISOString();
  let running = jobs.filter((j) => j.state === "generating").length;
  return jobs.map((job) => {
    if (job.state === "generating") {
      const progress = Math.min(100, job.progress + 9 + ((job.id.length * 7) % 11));
      if (job.slug === FAILS_ONCE && !job.error && progress >= 60) {
        return { ...job, state: "failed", progress: 60, error: "Generation timed out (demo).", updatedAt: stamp };
      }
      const itemsReady = Math.floor((progress / 100) * job.itemsTotal);
      return progress >= 100
        ? { ...job, state: "ready", progress: 100, itemsReady: job.itemsTotal, updatedAt: stamp }
        : { ...job, progress, itemsReady, updatedAt: stamp };
    }
    if (job.state === "queued" && running < MAX_PARALLEL) {
      running++;
      return { ...job, state: "generating", progress: 3, updatedAt: stamp };
    }
    return job;
  });
}

export function retryJob(job: GenerationJob, now = new Date()): GenerationJob {
  // Keep the error marker so the demo failure does not repeat.
  return { ...job, state: "queued", progress: 0, itemsReady: 0, updatedAt: now.toISOString(), error: job.error ? "retried" : undefined };
}

export function isActive(jobs: GenerationJob[]): boolean {
  return jobs.some((j) => j.state === "queued" || j.state === "generating");
}
