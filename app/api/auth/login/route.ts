import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { checkLogin, nextRouteFor } from "@/lib/server/auth/service";
import { createSession, destroyCurrentSession } from "@/lib/server/auth/session";
import { loginSchema } from "@/lib/validation/schemas";

export const POST = route(async (req) => {
  const body = await parseBody(req, loginSchema);
  await rateLimit("login-ip", clientIp(req), 30, 900);
  await rateLimit("login-email", body.email, 10, 900);
  const result = await checkLogin(body.email, body.password);
  if (result.kind === "needs_verification") {
    return json({ next: "/verify-email", needsVerification: true, resendAfterSeconds: result.resendAfterSeconds });
  }
  await destroyCurrentSession();
  await createSession(result.userId, req.headers.get("user-agent"));
  return json({ next: await nextRouteFor(result.userId) });
});
