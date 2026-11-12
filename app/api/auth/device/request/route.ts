import { clientIp, json, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { createRequest } from "@/lib/server/auth/device-link";

/**
 * Signed out (e.g. on a headset): get a code to approve from a signed-in phone or computer.
 * `secret` goes only to this device, which uses it to poll for the approval.
 */
export const POST = route(async (req) => {
  await rateLimit("device-request-ip", clientIp(req), 15, 900);
  const { code, secret, expiresAt } = await createRequest(req.headers.get("user-agent"));
  return json({ code, secret, expiresAt: expiresAt.toISOString() });
});
