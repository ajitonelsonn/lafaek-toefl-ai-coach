import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeSlug } from "@/lib/config/practice-types";
import { starterEntries } from "@/prisma/starter/convert";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";

// Deterministic provider fixtures (tests only). Behaviour can be switched per test.
const control = { mode: "ok" as "ok" | "transient" | "auth" | "malformed-once" | "malformed", calls: 0, failSlug: null as string | null };
vi.mock("@/lib/server/providers/meta", async () => {
  const { ProviderError } = await import("@/lib/server/providers/http");
  return {
    generateText: vi.fn(async ({ task }: { task: string }) => {
      control.calls++;
      const requestId = `req-${control.calls}`;
      const usage = { inputTokens: 100, outputTokens: 200 };
      if (task === "verify:build-sentence") return { data: { grammatical: true, uniqueOrder: true, issue: "" }, usage, model: "muse-spark-1.3", requestId };
      const slug = task.replace("generate:", "") as PracticeSlug;
      if (control.failSlug === slug || control.mode === "transient") throw new ProviderError("meta", "server", "meta request failed (503).", 503);
      if (control.mode === "auth") throw new ProviderError("meta", "auth", "meta request failed (401).", 401);
      if (control.mode === "malformed" || (control.mode === "malformed-once" && control.calls === 1)) return { data: { nonsense: true }, usage, model: "muse-spark-1.3", requestId };
      const fixture = starterEntries().find((e) => e.slug === slug)!.output;
      return { data: fixture, usage, model: "muse-spark-1.3", requestId };
    }),
    generateImage: vi.fn(),
    transcribeAudio: vi.fn(),
  };
});

import { db } from "@/lib/server/db";
import { savePlan } from "@/lib/server/study-plan";
import { claimJobs, recoverExpiredLeases, startInitialBatch } from "@/lib/server/generation/queue";
import { tick } from "@/lib/server/generation/worker";
import { getBatchStatus } from "@/lib/server/generation/status";
import { getOwnedItem, getPracticeSet } from "@/lib/server/practice";
import { createUser, resetTestDb } from "../support/db";

const INPUT: StudyPlanInputBody = { level: "intermediate", targetScore: 90, testDate: null, dailyMinutes: 30, studyDays: ["mon"], weakAreas: [], emphasis: "balanced", accents: ["en-US"], goals: "" };

async function drain(owner = "test-worker") {
  for (let i = 0; i < 100; i++) {
    const n = await tick(owner, 3);
    if (n === 0) break;
  }
}

beforeEach(async () => {
  await resetTestDb();
  Object.assign(control, { mode: "ok", calls: 0, failSlug: null });
});

describe("generation batches", () => {
  it("creates exactly one batch for repeated or concurrent start requests", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    const key = randomUUID();
    const results = await Promise.all([startInitialBatch(u.id, key), startInitialBatch(u.id, key), startInitialBatch(u.id, randomUUID())]);
    expect(new Set(results.map((b) => b.id)).size).toBe(1);
    expect(await db.generationBatch.count()).toBe(1);
    expect(await db.generationJob.count({ where: { jobType: "task_pack" } })).toBe(12);
  });

  it("a worker limited to non-Meta job types leaves task packs alone", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    await startInitialBatch(u.id, randomUUID());
    expect(await claimJobs("audio-only", 5, ["asset_audio", "delete_user_assets"])).toHaveLength(0);
    expect(await claimJobs("full", 5)).toHaveLength(1);
  });

  it("allows one study plan per 30 days; a later plan gets its own batch", async () => {
    const u = await createUser("a@example.com");
    const first = await savePlan(u.id, { ...INPUT }, false);
    expect(first.nextPlanAt).not.toBeNull();
    const firstBatch = await startInitialBatch(u.id, randomUUID());
    await expect(savePlan(u.id, { ...INPUT, targetScore: 100 }, true)).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    expect(await db.studyPlan.count({ where: { userId: u.id } })).toBe(1);

    // 31 days later a new plan is allowed and starts a new batch.
    await db.studyPlan.updateMany({ where: { userId: u.id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    const second = await savePlan(u.id, { ...INPUT, targetScore: 100 }, true);
    expect(second.version).toBe(2);
    const secondBatch = await startInitialBatch(u.id, randomUUID());
    expect(secondBatch.id).not.toBe(firstBatch.id);
    expect(secondBatch.planVersion).toBe(2);
  });

  it("generates, validates and stores every task type; re-running creates no duplicates", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    const batch = await startInitialBatch(u.id, randomUUID());
    await drain();
    const status = await getBatchStatus(u.id, batch.id);
    expect(status?.status).toBe("completed");
    const perTask = Number(process.env.GENERATION_ITEMS_PER_TASK ?? 2);
    const items = await db.practiceItem.count({ where: { userId: u.id } });
    expect(items).toBeGreaterThanOrEqual(12);
    expect(items).toBeLessThanOrEqual(12 * perTask);
    // Re-queue everything and process again: completed items are checkpointed, not regenerated.
    const callsBefore = control.calls;
    await db.generationJob.updateMany({ where: { jobType: "task_pack" }, data: { status: "queued", attemptCount: 0 } });
    await drain();
    expect(await db.practiceItem.count({ where: { userId: u.id } })).toBe(items);
    expect(control.calls).toBe(callsBefore);
    // Asset jobs wait for storage configuration rather than failing silently.
    expect(await db.generationJob.count({ where: { jobType: { in: ["asset_audio", "asset_image"] }, status: "blocked_configuration" } })).toBeGreaterThan(0);
  }, 600_000);

  it("retries transient provider errors with backoff and fails permanent ones", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    await startInitialBatch(u.id, randomUUID());
    control.mode = "transient";
    await tick("w", 1);
    const retrying = await db.generationJob.findFirstOrThrow({ where: { status: "retry_wait" } });
    expect(retrying.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(retrying.errorCode).toBe("PROVIDER_SERVER");

    control.mode = "auth";
    await db.generationJob.updateMany({ data: { status: "queued", nextAttemptAt: new Date() } });
    await tick("w", 1);
    expect(await db.generationJob.count({ where: { status: "failed", errorCode: "PROVIDER_AUTH" } })).toBe(1);
  });

  it("rejects malformed output, repairs once, and never stores invalid content", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    await startInitialBatch(u.id, randomUUID());
    control.mode = "malformed";
    await tick("w", 1);
    expect(await db.practiceItem.count({ where: { userId: u.id } })).toBe(0);
    const job = await db.generationJob.findFirstOrThrow({ where: { status: "retry_wait" } });
    expect(job.errorCode).toBe("INVALID_OUTPUT");

    control.mode = "malformed-once";
    control.calls = 0;
    await db.generationJob.updateMany({ data: { nextAttemptAt: new Date() } });
    await tick("w", 1);
    expect(await db.practiceItem.count({ where: { userId: u.id } })).toBeGreaterThan(0);
  });

  it("keeps completed tasks available when other tasks fail", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    const batch = await startInitialBatch(u.id, randomUUID());
    control.failSlug = "write-email";
    await db.generationJob.updateMany({ data: { maxAttempts: 1 } });
    await drain();
    const s = await getBatchStatus(u.id, batch.id);
    expect(s?.status).toBe("partial");
    expect(s?.tasks.find((t) => t.slug === "write-email")?.state).toBe("failed");
    expect(s?.tasks.filter((t) => t.state === "ready")).toHaveLength(11);
    expect((await getPracticeSet(u.id, "read-in-daily-life")).generatedCount).toBeGreaterThan(0);
  });

  it("recovers a job whose worker crashed (expired lease)", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    await startInitialBatch(u.id, randomUUID());
    const [job] = await claimJobs("crashed-worker", 1);
    expect(job.status).toBe("running");
    await db.generationJob.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    expect(await recoverExpiredLeases()).toBe(1);
    const recovered = await db.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(recovered.status).toBe("retry_wait");
    expect(recovered.leaseOwner).toBeNull();
    // A healthy worker then picks it up again (after the other due jobs) and finishes it.
    await drain("healthy");
    expect((await db.generationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("completed");
  });

  it("records usage idempotently by provider request id", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    await startInitialBatch(u.id, randomUUID());
    await drain();
    const events = await db.usageEvent.findMany({ where: { userId: u.id } });
    expect(new Set(events.map((e) => e.idempotencyKey)).size).toBe(events.length);
    expect(events.every((e) => e.inputUnits === 100 && e.outputUnits === 200)).toBe(true);
  });

  it("enforces per-user concurrency of one running job", async () => {
    const u = await createUser("a@example.com");
    await savePlan(u.id, { ...INPUT }, false);
    await startInitialBatch(u.id, randomUUID());
    const claimed = await claimJobs("w", 5);
    expect(claimed).toHaveLength(1);
  });
});

describe("authorization between users", () => {
  it("user B cannot read user A's generated items or batch", async () => {
    const a = await createUser("a@example.com");
    const b = await createUser("b@example.com");
    await savePlan(a.id, { ...INPUT }, false);
    const batch = await startInitialBatch(a.id, randomUUID());
    await drain();
    const item = await db.practiceItem.findFirstOrThrow({ where: { userId: a.id } });
    await expect(getOwnedItem(b.id, item.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOwnedItem(a.id, item.id)).resolves.toMatchObject({ id: item.id });
    expect(await getBatchStatus(b.id, batch.id)).toBeNull();
    expect((await getPracticeSet(b.id, "read-in-daily-life")).generatedCount).toBe(0);
  });
});
