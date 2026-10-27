import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth/session";

// Admin-only view of failed and blocked jobs (sanitized: no payloads or user data).
export const GET = route(async () => {
  await requireAdmin();
  const jobs = await db.generationJob.findMany({
    where: { status: { in: ["failed", "blocked_configuration", "retry_wait"] } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, jobType: true, taskSlug: true, status: true, attemptCount: true, maxAttempts: true, errorCode: true, errorSummary: true, updatedAt: true, batchId: true },
  });
  return json({ jobs });
});
