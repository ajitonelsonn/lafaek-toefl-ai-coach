import { json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { deviceUsage, requireAuth } from "@/lib/server/auth/session";
import { cancelShareCodes, createShareCode } from "@/lib/server/auth/device-link";

/** Signed in: make a one-time code (and QR code) for another device. That device still needs approval here. */
export const POST = route(async () => {
  const auth = await requireAuth();
  await rateLimit("device-share-user", auth.user.id, 20, 900);
  const [{ id, code, expiresAt }, usage] = await Promise.all([createShareCode(auth.user.id), deviceUsage(auth.user.id)]);
  return json({ id, code, expiresAt: expiresAt.toISOString(), devices: usage });
});

/** The code window was closed: a code not yet approved stops working. */
export const DELETE = route(async () => {
  const auth = await requireAuth();
  await cancelShareCodes(auth.user.id);
  return json({ status: "cancelled" });
});
