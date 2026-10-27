import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getBatchStatus } from "@/lib/server/generation/status";

export const GET = route<{ batchId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const batch = await getBatchStatus(user.id, validate(uuidParam, params.batchId));
  if (!batch) throw new ApiError(404, "NOT_FOUND", "This generation batch was not found.");
  return json({ batch });
});
