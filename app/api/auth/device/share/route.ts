import { json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { requireAuth } from "@/lib/server/auth/session";
import { cancelShareCodes, createShareCode } from "@/lib/server/auth/device-link";

/** Signed in: make a one-time code (and QR code) that signs another device in to this account. */
export const POST = route(async () => {
  const auth = await requireAuth();
  await rateLimit("device-share-user", auth.user.id, 20, 900);
  const { code, expiresAt } = await createShareCode(auth.user.id);
  return json({ code, expiresAt: expiresAt.toISOString() });
});

/** The code window was closed: an unused code stops working. */
export const DELETE = route(async () => {
  const auth = await requireAuth();
  await cancelShareCodes(auth.user.id);
  return json({ status: "cancelled" });
});
