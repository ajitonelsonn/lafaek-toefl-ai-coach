import { db } from "@/lib/server/db";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { deleteObject } from "@/lib/server/storage/s3";

// Learners may delete their own recordings. Generated practice media is kept with its item.
export const DELETE = route<{ assetId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const asset = await db.mediaAsset.findFirst({ where: { id: validate(uuidParam, params.assetId), userId: user.id, kind: "recording", deletedAt: null } });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "This recording was not found.");
  await deleteObject(asset.objectKey);
  await db.mediaAsset.update({ where: { id: asset.id }, data: { status: "deleted", deletedAt: new Date() } });
  return json({ status: "deleted" });
});
