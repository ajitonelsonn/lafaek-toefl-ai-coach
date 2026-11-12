import { json, route } from "@/lib/server/http";
import { listDevices, MAX_DEVICES, requireAuth, revokeOtherDevices } from "@/lib/server/auth/session";

/** The devices signed in to this account (at most MAX_DEVICES), most recently used first. */
export const GET = route(async () => {
  const auth = await requireAuth();
  return json({ max: MAX_DEVICES, devices: await listDevices(auth.user.id, auth.sessionId) });
});

/** Signs out every device except this one. */
export const DELETE = route(async () => {
  const auth = await requireAuth();
  const count = await revokeOtherDevices(auth.user.id, auth.sessionId);
  return json({ status: "signed_out", count });
});
