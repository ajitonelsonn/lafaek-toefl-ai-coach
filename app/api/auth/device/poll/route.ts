import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { nextRouteFor } from "@/lib/server/auth/service";
import { createSession, destroyCurrentSession } from "@/lib/server/auth/session";
import { pollRequest } from "@/lib/server/auth/device-link";
import { devicePollSchema } from "@/lib/validation/schemas";

/** The waiting device checks whether its code was approved; on approval it is signed in here. */
export const POST = route(async (req) => {
  const { secret } = await parseBody(req, devicePollSchema);
  // A poll every 2.5 s for the 10-minute life of a code is 240; leave room for a second tab.
  await rateLimit("device-poll-ip", clientIp(req), 600, 900);
  const result = await pollRequest(secret);
  if (result.status !== "approved") return json({ status: result.status });
  await destroyCurrentSession();
  await createSession(result.userId, req.headers.get("user-agent"));
  return json({ status: "signed_in", next: await nextRouteFor(result.userId) });
});
