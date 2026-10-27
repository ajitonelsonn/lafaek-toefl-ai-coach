import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { startSignup } from "@/lib/server/auth/service";
import { signupSchema } from "@/lib/validation/schemas";

export const POST = route(async (req) => {
  const body = await parseBody(req, signupSchema);
  await rateLimit("signup-ip", clientIp(req), 10, 3600);
  await rateLimit("signup-email", body.email, 5, 3600);
  const { resendAfterSeconds } = await startSignup(body);
  return json({ status: "verification_sent", resendAfterSeconds });
});
