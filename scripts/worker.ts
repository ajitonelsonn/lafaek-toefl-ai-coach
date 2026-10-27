// Long-running generation worker. Run locally with `npm run worker`, and in
// production as a Render Background Worker (`npm run worker:prod`).
import { log } from "../lib/server/log";
import { housekeeping, tick, workerId } from "../lib/server/generation/worker";

const owner = workerId();
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);
let stopping = false;

process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log.info("worker started", { owner, concurrency });
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
