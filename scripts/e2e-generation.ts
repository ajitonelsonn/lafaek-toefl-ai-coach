// End-to-end check of the real generation pipeline (real Meta calls, real DB).
// Creates a throwaway user + plan, starts the batch, runs the worker until idle,
// reports per-task results, verifies idempotency, then deletes the test user.
// Run: GENERATION_ITEMS_PER_TASK=1 npx dotenv -e .env.local -- tsx --conditions=react-server scripts/e2e-generation.ts [--keep]
import { randomUUID } from "node:crypto";
import { db } from "../lib/server/db";
import { savePlan } from "../lib/server/study-plan";
import { startInitialBatch } from "../lib/server/generation/queue";
import { tick, workerId } from "../lib/server/generation/worker";
import { getBatchStatus } from "../lib/server/generation/status";
import { getPracticeSet } from "../lib/server/practice";
import { PRACTICE_TYPES } from "../lib/config/practice-types";

async function main() {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.invalid`;
  const user = await db.user.create({ data: { emailNormalized: email, displayName: "E2E Test", status: "active", emailVerifiedAt: new Date() } });
  console.log("test user created");
  try {
    await savePlan(user.id, { level: "intermediate", targetScore: 90, testDate: null, dailyMinutes: 30, studyDays: ["mon", "wed", "fri"], weakAreas: ["listening"], emphasis: "balanced", accents: ["en-US", "en-GB"], goals: "University admission" }, false);
    const key = randomUUID();
    const b1 = await startInitialBatch(user.id, key);
    const b2 = await startInitialBatch(user.id, key);
    const b3 = await startInitialBatch(user.id, randomUUID());
    const jobs = await db.generationJob.count({ where: { batchId: b1.id } });
    console.log(`idempotency: same batch for repeated calls=${b1.id === b2.id && b2.id === b3.id}; task jobs=${jobs}`);

    const owner = workerId();
    const started = Date.now();
    for (let i = 0; i < 200; i++) {
      const n = await tick(owner, 3);
      const pending = await db.generationJob.count({ where: { userId: user.id, jobType: "task_pack", status: { in: ["queued", "running", "validating", "storing"] } } });
      const waiting = await db.generationJob.count({ where: { userId: user.id, jobType: "task_pack", status: "retry_wait" } });
      if (n === 0 && pending === 0) {
        if (waiting === 0) break;
        // Retries are scheduled with backoff; pull them forward for the test.
        await db.generationJob.updateMany({ where: { userId: user.id, status: "retry_wait" }, data: { nextAttemptAt: new Date() } });
      }
    }
    const status = await getBatchStatus(user.id, b1.id);
    console.log(`batch status=${status?.status} completed=${status?.completedTasks}/${status?.totalTasks} failed=${status?.failedTasks} elapsed=${Math.round((Date.now() - started) / 1000)}s`);
    const taskJobs = await db.generationJob.findMany({ where: { batchId: b1.id }, select: { taskSlug: true, status: true, attemptCount: true, errorCode: true, errorSummary: true } });
    for (const t of PRACTICE_TYPES) {
      const j = taskJobs.find((x) => x.taskSlug === t.slug)!;
      const set = await getPracticeSet(user.id, t.slug);
      const leaked = JSON.stringify(set.view).match(/answerKey|answerIndex|"answerId"/);
      console.log(`  ${t.slug.padEnd(24)} ${j.status.padEnd(10)} attempts=${j.attemptCount} generated=${set.generatedCount} leak=${leaked ? "YES" : "no"}${j.errorCode ? ` error=${j.errorCode}: ${j.errorSummary?.slice(0, 120)}` : ""}`);
    }
    const assets = await db.generationJob.groupBy({ by: ["jobType", "status"], where: { userId: user.id, jobType: { in: ["asset_audio", "asset_image"] } }, _count: { _all: true } });
    console.log("asset jobs:", assets.map((a) => `${a.jobType}/${a.status}=${a._count._all}`).join(", ") || "none");
    const usage = await db.usageEvent.aggregate({ where: { userId: user.id }, _count: { _all: true }, _sum: { inputUnits: true, outputUnits: true } });
    console.log(`usage events=${usage._count._all} inputTokens=${usage._sum.inputUnits} outputTokens=${usage._sum.outputUnits}`);
    const dupKeys = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) - count(DISTINCT content_key) AS n FROM practice_items WHERE user_id = ${user.id}::uuid`;
    console.log(`duplicate items=${Number(dupKeys[0].n)}`);
  } finally {
    if (!process.argv.includes("--keep")) {
      await db.generationJob.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
      console.log("test user deleted");
    }
    await db.$disconnect();
  }
}

main();
