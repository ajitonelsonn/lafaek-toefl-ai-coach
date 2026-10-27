import "server-only";
import { db } from "../db";
import { ApiError } from "../http";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../crypto";
import { sendExistingAccountEmail } from "../mailer";
import { issueOtp } from "./otp";

export async function nextRouteFor(userId: string): Promise<"/dashboard" | "/study-plan"> {
  const plan = await db.studyPlan.findFirst({ where: { userId, status: "active" }, select: { id: true } });
  return plan ? "/dashboard" : "/study-plan";
}

/**
 * Starts or refreshes a pending registration. The response is the same
 * whether or not the email already has an account.
 */
export async function startSignup(input: { name: string; email: string; password: string }): Promise<{ resendAfterSeconds: number }> {
  const existing = await db.user.findUnique({ where: { emailNormalized: input.email } });
  if (existing && existing.status !== "pending") {
    // Tell the real owner instead of revealing the account to the requester.
    await sendExistingAccountEmail(input.email).catch(() => undefined);
    return { resendAfterSeconds: 60 };
  }
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.upsert({
    where: { emailNormalized: input.email },
    create: { emailNormalized: input.email, displayName: input.name, passwordHash, status: "pending" },
    update: { displayName: input.name, passwordHash },
  });
  return issueOtp(input.email, "signup", user.id);
}

export async function activateVerifiedUser(email: string) {
  const user = await db.user.findUnique({ where: { emailNormalized: email } });
  if (!user || user.status === "disabled" || user.status === "deleted") {
    throw new ApiError(400, "INVALID_CODE", "That code is not correct. Please check it and try again.");
  }
  return db.user.update({
    where: { id: user.id },
    data: {
      status: "active",
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      lastLoginAt: new Date(),
      preferences: { connectOrCreate: { where: { userId: user.id }, create: {} } },
    },
  });
}

export type LoginResult = { kind: "ok"; userId: string } | { kind: "needs_verification"; resendAfterSeconds: number };

export async function checkLogin(email: string, password: string): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { emailNormalized: email } });
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await dummyPasswordHash()), false);
  if (!user || !ok || user.status === "disabled" || user.status === "deleted") {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  if (user.status === "pending") {
    const { resendAfterSeconds } = await issueOtp(email, "signup", user.id);
    return { kind: "needs_verification", resendAfterSeconds };
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { kind: "ok", userId: user.id };
}
