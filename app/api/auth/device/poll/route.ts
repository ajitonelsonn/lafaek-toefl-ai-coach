import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { nextRouteFor } from "@/lib/server/auth/service";
import { createSession, destroyCurrentSession } from "@/lib/server/auth/session";
import { pollClaim } from "@/lib/server/auth/device-link";
import { devicePollSchema } from "@/lib/validation/schemas";

/** The device that entered a code checks whether it was approved; once it is, it is signed in here. */
export const POST = route(async (req) => {
  const { secret } = await parseBody(req, devicePollSchema);
  // A poll every 2 s for a few minutes is about 150; leave room for a second tab.
  await rateLimit("device-poll-ip", clientIp(req), 600, 900);
  const result = await pollClaim(secret);
  if (result.status !== "approved") return json({ status: result.status });
  await destroyCurrentSession();
  await createSession(result.userId, req.headers.get("user-agent"));
  return json({ status: "signed_in", next: await nextRouteFor(result.userId) });
});
