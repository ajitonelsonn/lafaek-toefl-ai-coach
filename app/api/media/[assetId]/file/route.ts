import { db } from "@/lib/server/db";
import { ApiError, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getObject } from "@/lib/server/storage/s3";

/**
 * Same-origin media bytes for the VR study room (/vr). WebGL textures and Web Audio cannot read
 * cross-origin S3 signed URLs without CORS, so the room loads pictures and audio through here.
 * Same ownership rule as /url: starter-set media is shared, everything else is owner-only.
 */
export const GET = route<{ assetId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const asset = await db.mediaAsset.findFirst({
    where: {
      id: validate(uuidParam, params.assetId),
      status: "ready",
      deletedAt: null,
      kind: { in: ["audio", "image"] },
      OR: [{ userId: user.id }, { userId: null, practiceItem: { source: "starter" } }],
    },
  });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "This media was not found.");
  const bytes = await getObject(asset.objectKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
