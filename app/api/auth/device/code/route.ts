import { ApiError, clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { nextRouteFor } from "@/lib/server/auth/service";
import { createSession, destroyCurrentSession, deviceUsage, getAuth } from "@/lib/server/auth/session";
import { approveRequest, consumeShare, describeDevice, findLiveCode } from "@/lib/server/auth/device-link";
import { deviceCodeSchema } from "@/lib/validation/schemas";

/**
 * A code typed in, or opened from a scanned QR code.
 * - Share code (made on a signed-in device): signs this device in to that account.
 * - Request code (shown on a waiting headset): needs this device to be signed in. Without
 *   `approve` it only says which device is waiting, so the learner can confirm it is theirs.
 */
export const POST = route(async (req) => {
  const body = await parseBody(req, deviceCodeSchema);
  await rateLimit("device-code-ip", clientIp(req), 20, 900);
  const link = await findLiveCode(body.code);

  if (link.kind === "share") {
    const userId = await consumeShare(link);
    const auth = await getAuth();
    if (auth?.user.id !== userId) {
      await destroyCurrentSession();
      await createSession(userId, req.headers.get("user-agent"));
    }
    return json({ status: "signed_in", next: await nextRouteFor(userId) });
  }

  const auth = await getAuth();
  if (!auth) throw new ApiError(401, "UNAUTHENTICATED", "This code is for approving a device. Sign in on this device first, then enter the code again.");
  if (!body.approve) {
    // At the device limit, say which device the approval will sign out.
    const usage = await deviceUsage(auth.user.id);
    return json({ status: "confirm", device: describeDevice(link.userAgent).label, willSignOut: usage.willSignOut });
  }
  await approveRequest(link, auth.user.id);
  return json({ status: "approved" });
});
