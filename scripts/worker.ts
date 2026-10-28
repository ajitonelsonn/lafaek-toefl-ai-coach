// Long-running generation worker. Run locally with `npm run worker`, and in
// production as a Render Background Worker (`npm run worker:prod`).
import { createHash } from "node:crypto";
import type { JobType } from "@prisma/client";
import { log } from "../lib/server/log";
import { env } from "../lib/server/env";
import { housekeeping, runPool, workerId } from "../lib/server/generation/worker";
import { ALL_JOB_TYPES, META_JOB_TYPES, unblockJobs } from "../lib/server/generation/queue";

const owner = workerId();
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
let stopping = false;

process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

/**
 * Logs the Meta settings this process actually sees (never the key, only a short fingerprint)
 * and returns false only when Meta answers but lists none of our text models. Meta has served
 * an empty catalog to some networks (e.g. Render/AWS, 2026-10-27); network errors count as
 * "unknown" so a brief outage does not stop generation.
 */
async function metaConfigCheck(quiet: boolean): Promise<boolean> {
  const e = env();
  const fingerprint = e.MODEL_API_KEY ? createHash("sha256").update(e.MODEL_API_KEY).digest("hex").slice(0, 12) : null;
  const res = await fetch(`${e.META_API_BASE_URL.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${e.MODEL_API_KEY ?? ""}` } }).catch(() => null);
  const visible: string[] | null = res?.ok ? (((await res.json()) as { data?: { id?: string }[] }).data ?? []).map((m) => m.id ?? "") : null;
  const models = { text: e.META_TEXT_MODEL, textFallback: e.META_TEXT_FALLBACK_MODEL, image: e.META_IMAGE_MODEL, transcription: e.META_TRANSCRIPTION_MODEL };
  const reachable = visible === null || visible.includes(models.text) || visible.includes(models.textFallback);
  if (!quiet) {
    log.info("meta config", {
      baseUrl: e.META_API_BASE_URL,
      models,
      plainAscii: Object.values(models).every((m) => /^[\x21-\x7e]+$/.test(m)),
      keyFingerprint: fingerprint,
      available: Object.fromEntries(Object.entries(models).map(([k, m]) => [k, visible?.includes(m) ?? null])),
      visibleModels: visible ?? [res ? `HTTP ${res.status}` : "network error"],
    });
  }
  return reachable;
}

async function main() {
  log.info("worker started", { owner, concurrency });
  let metaOk = await metaConfigCheck(false).catch(() => true);
  const jobTypesFor = (ok: boolean): JobType[] => (ok ? ALL_JOB_TYPES : ALL_JOB_TYPES.filter((t) => !META_JOB_TYPES.includes(t)));
  if (!metaOk) log.warn("meta models not visible from this network; skipping text and image jobs", { jobTypes: jobTypesFor(false) });
  // Settings changes restart the worker, so retry jobs that were waiting on provider setup once.
  // Re-queued Meta jobs left by a worker that cannot reach Meta wait for one that can.
  const requeued = await unblockJobs(["task_pack", "asset_audio", "asset_image", "vocabulary_pack", "study_schedule"], "PROVIDER_CONFIG").catch(() => 0);
  if (requeued) log.info("requeued jobs waiting on provider setup", { count: requeued });
  let lastHousekeeping = 0;
  await runPool(owner, concurrency, {
    jobTypes: () => jobTypesFor(metaOk),
    stopping: () => stopping,
    once: process.argv.includes("--once"),
    beforeClaim: async () => {
      if (Date.now() - lastHousekeeping < 10 * 60_000) return;
      lastHousekeeping = Date.now();
      await housekeeping();
      const ok = await metaConfigCheck(true).catch(() => metaOk);
      if (ok !== metaOk) log.info("meta availability changed", { metaOk: ok, jobTypes: jobTypesFor(ok) });
      metaOk = ok;
    },
  });
  log.info("worker stopped", { owner });
  process.exit(0);
}

main();
