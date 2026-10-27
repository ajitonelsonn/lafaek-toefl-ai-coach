import { db } from "@/lib/server/db";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { signedGetUrl } from "@/lib/server/storage/s3";

// Ownership-checked, short-lived signed URL. Starter-set media is shared; everything else is owner-only.
export const GET = route<{ assetId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const asset = await db.mediaAsset.findFirst({
    where: {
      id: validate(uuidParam, params.assetId),
      status: "ready",
      deletedAt: null,
      OR: [{ userId: user.id }, { userId: null, practiceItem: { source: "starter" } }],
    },
  });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "This media was not found.");
  const expiresIn = 300;
  return json({ url: await signedGetUrl(asset.objectKey, asset.mimeType, expiresIn), expiresIn, mimeType: asset.mimeType });
});
