import "server-only";
import type { OtpPurpose } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http";
import { generateOtp, hashOtp, safeEqualHex } from "../crypto";
import { sendOtpEmail } from "../mailer";

/**
 * Issues a new one-time code for (email, purpose): enforces the resend
 * cooldown, invalidates earlier unused codes, stores only an HMAC, and emails it.
 */
export async function issueOtp(emailNormalized: string, purpose: OtpPurpose, userId: string | null): Promise<{ resendAfterSeconds: number }> {
  const { OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS } = env();
  const last = await db.authOtp.findFirst({ where: { emailNormalized, purpose }, orderBy: { lastSentAt: "desc" } });
  if (last) {
    const wait = OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - last.lastSentAt.getTime()) / 1000);
    if (wait > 0) return { resendAfterSeconds: wait };
  }
  const code = generateOtp();
  await db.$transaction([
    db.authOtp.updateMany({ where: { emailNormalized, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.authOtp.create({
      data: {
        emailNormalized,
        purpose,
        userId,
        otpHash: hashOtp(emailNormalized, purpose, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    }),
  ]);
  await sendOtpEmail(emailNormalized, code, OTP_TTL_MINUTES);
  return { resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

/** Verifies and consumes a code exactly once. Throws INVALID_CODE / CODE_EXPIRED. */
export async function consumeOtp(emailNormalized: string, purpose: OtpPurpose, code: string): Promise<void> {
  const { OTP_MAX_ATTEMPTS } = env();
  const otp = await db.authOtp.findFirst({ where: { emailNormalized, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  const invalid = new ApiError(400, "INVALID_CODE", "That code is not correct. Please check it and try again.");
  if (!otp) throw invalid;
  if (otp.expiresAt < new Date()) throw new ApiError(400, "CODE_EXPIRED", "This code has expired. Please request a new one.");

  // Count the attempt first (atomically), so parallel guesses cannot exceed the limit.
  const counted = await db.authOtp.updateMany({
    where: { id: otp.id, consumedAt: null, attemptCount: { lt: OTP_MAX_ATTEMPTS } },
    data: { attemptCount: { increment: 1 } },
  });
  if (counted.count === 0) throw new ApiError(429, "RATE_LIMITED", "Too many wrong codes. Please request a new code.");

  if (!/^\d{6}$/.test(code) || !safeEqualHex(hashOtp(emailNormalized, purpose, code), otp.otpHash)) throw invalid;

  const consumed = await db.authOtp.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw invalid;
}
