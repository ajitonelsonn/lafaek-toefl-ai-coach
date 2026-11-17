import { db } from "@/lib/server/db";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { sharedContentOwner } from "@/lib/server/auth/guest";
import { signedGetUrl } from "@/lib/server/storage/s3";

// Ownership-checked, short-lived signed URL. Starter-set media is shared; everything else is owner-only.
export const GET = route<{ assetId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const shared = await sharedContentOwner(user.id);
  const asset = await db.mediaAsset.findFirst({
    where: {
      id: validate(uuidParam, params.assetId),
      status: "ready",
      deletedAt: null,
      // Own media, the shared starter set, and for a guest the demo account's question media
      // (never its recordings).
      OR: [{ userId: user.id }, { userId: null, practiceItem: { source: "starter" } }, ...(shared ? [{ userId: shared, attemptId: null, practiceItemId: { not: null }, kind: { in: ["audio", "image"] as ("audio" | "image")[] } }] : [])],
    },
  });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "This media was not found.");
  const expiresIn = 300;
  return json({ url: await signedGetUrl(asset.objectKey, asset.mimeType, expiresIn), expiresIn, mimeType: asset.mimeType });
});
