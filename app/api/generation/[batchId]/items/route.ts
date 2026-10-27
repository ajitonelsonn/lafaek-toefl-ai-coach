import { db } from "@/lib/server/db";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";

export const GET = route<{ batchId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const batch = await db.generationBatch.findFirst({ where: { id: validate(uuidParam, params.batchId), userId: user.id } });
  if (!batch) throw new ApiError(404, "NOT_FOUND", "This generation batch was not found.");
  const counts = await db.practiceItem.groupBy({ by: ["taskSlug"], where: { userId: user.id, studyPlanId: batch.studyPlanId, validationStatus: "valid" }, _count: { _all: true } });
  return json({ tasks: counts.map((c) => ({ slug: c.taskSlug, readyItems: c._count._all })) });
});
