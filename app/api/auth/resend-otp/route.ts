import { db } from "@/lib/server/db";
import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { issueOtp } from "@/lib/server/auth/otp";
import { resendSchema } from "@/lib/validation/schemas";
import { env } from "@/lib/server/env";

export const POST = route(async (req) => {
  const { email } = await parseBody(req, resendSchema);
  await rateLimit("resend-ip", clientIp(req), 10, 3600);
  await rateLimit("resend-email", email, 6, 3600);
  const user = await db.user.findUnique({ where: { emailNormalized: email }, select: { id: true, status: true } });
  // Same response whether or not a pending registration exists.
  if (!user || user.status !== "pending") return json({ status: "ok", resendAfterSeconds: env().OTP_RESEND_COOLDOWN_SECONDS });
  const { resendAfterSeconds } = await issueOtp(email, "signup", user.id);
  return json({ status: "ok", resendAfterSeconds });
});
