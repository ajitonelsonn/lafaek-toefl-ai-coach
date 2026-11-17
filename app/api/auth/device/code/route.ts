import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { claimCode } from "@/lib/server/auth/device-link";
import { deviceCodeSchema } from "@/lib/validation/schemas";

/**
 * The new device enters (or scans) a code from a signed-in device. This only asks to sign in: the
 * signed-in device must approve. `secret` goes only to this device, which polls with it.
 */
export const POST = route(async (req) => {
  const { code } = await parseBody(req, deviceCodeSchema);
  await rateLimit("device-code-ip", clientIp(req), 20, 900);
  const { secret, expiresAt } = await claimCode(code, req.headers.get("user-agent"));
  return json({ status: "waiting", secret, expiresAt: expiresAt.toISOString() });
});
