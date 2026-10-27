import { z } from "zod";
import { db } from "@/lib/server/db";
import { json, parseBody, route } from "@/lib/server/http";
import { destroyCurrentSession, requireAuth, revokeAllSessions } from "@/lib/server/auth/session";
import { enqueueJob } from "@/lib/server/generation/queue";
import { log } from "@/lib/server/log";

// Deletes the account: revokes sessions, queues S3 cleanup (idempotent job that
// survives the user row), then deletes the user and all their rows (cascade).
export const DELETE = route(async (req, { requestId }) => {
  const { user } = await requireAuth();
  await parseBody(req, z.object({ confirm: z.literal("DELETE") }));
  const media = await db.mediaAsset.findMany({ where: { userId: user.id, deletedAt: null }, select: { objectKey: true } });
  await enqueueJob({ idempotencyKey: `delete_user_assets:${user.id}`, jobType: "delete_user_assets", userId: null, payload: { objectKeys: media.map((m) => m.objectKey) }, blocked: false });
  await revokeAllSessions(user.id);
  await db.user.delete({ where: { id: user.id } });
  await destroyCurrentSession();
  log.info("account deleted", { requestId, objects: media.length });
  return json({ status: "deleted" });
});
