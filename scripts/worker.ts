// Long-running generation worker. Run locally with `npm run worker`, and in
// production as a Render Background Worker (`npm run worker:prod`).
import { createHash } from "node:crypto";
import { log } from "../lib/server/log";
import { env } from "../lib/server/env";
import { housekeeping, tick, workerId } from "../lib/server/generation/worker";
import { unblockJobs } from "../lib/server/generation/queue";

const owner = workerId();
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
let stopping = false;

process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Logs the Meta settings this process actually sees (never the key, only a short fingerprint). */
async function metaConfigCheck() {
  const e = env();
  const fingerprint = e.MODEL_API_KEY ? createHash("sha256").update(e.MODEL_API_KEY).digest("hex").slice(0, 12) : null;
  const visible: string[] = await fetch(`${e.META_API_BASE_URL.replace(/\/$/, "")}/models`, { headers: { Authorization: `Bearer ${e.MODEL_API_KEY ?? ""}` } })
    .then(async (r) => (r.ok ? (((await r.json()) as { data?: { id?: string }[] }).data ?? []).map((m) => m.id ?? "") : [`HTTP ${r.status}`]))
    .catch(() => ["network error"]);
  const models = { text: e.META_TEXT_MODEL, image: e.META_IMAGE_MODEL, transcription: e.META_TRANSCRIPTION_MODEL };
  log.info("meta config", {
    baseUrl: e.META_API_BASE_URL,
    models,
    plainAscii: Object.values(models).every((m) => /^[\x21-\x7e]+$/.test(m)),
    keyFingerprint: fingerprint,
    available: Object.fromEntries(Object.entries(models).map(([k, m]) => [k, visible.includes(m)])),
    visibleModels: visible,
  });
}

async function main() {
  log.info("worker started", { owner, concurrency });
  await metaConfigCheck().catch(() => log.warn("meta config check failed"));
  // Settings changes restart the worker, so retry jobs that were waiting on provider setup once.
  const requeued = await unblockJobs(["task_pack", "asset_audio", "asset_image"], "PROVIDER_CONFIG").catch(() => 0);
  if (requeued) log.info("requeued jobs waiting on provider setup", { count: requeued });
  let lastHousekeeping = 0;
  const once = process.argv.includes("--once");
  while (!stopping) {
    try {
      if (Date.now() - lastHousekeeping > 10 * 60_000) {
        await housekeeping();
        lastHousekeeping = Date.now();
      }
      const n = await tick(owner, concurrency);
      if (once && n === 0) break;
      if (n === 0) await sleep(3000);
    } catch (e) {
      log.error("worker loop error", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
      await sleep(5000);
    }
  }
  log.info("worker stopped", { owner });
  process.exit(0);
}

main();
