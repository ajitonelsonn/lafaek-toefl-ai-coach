import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { consumeOtp } from "@/lib/server/auth/otp";
import { activateVerifiedUser, nextRouteFor } from "@/lib/server/auth/service";
import { createSession, destroyCurrentSession } from "@/lib/server/auth/session";
import { verifyEmailSchema } from "@/lib/validation/schemas";

export const POST = route(async (req) => {
  const body = await parseBody(req, verifyEmailSchema);
  await rateLimit("verify-ip", clientIp(req), 30, 900);
  await consumeOtp(body.email, "signup", body.code);
  const user = await activateVerifiedUser(body.email);
  await destroyCurrentSession();
  await createSession(user.id, req.headers.get("user-agent"));
  return json({ next: await nextRouteFor(user.id) });
});
