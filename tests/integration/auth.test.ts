import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; code?: string; kind: string }[] = [];
vi.mock("@/lib/server/mailer", () => ({
  sendOtpEmail: vi.fn(async (to: string, code: string) => void sent.push({ to, code, kind: "otp" })),
  sendExistingAccountEmail: vi.fn(async (to: string) => void sent.push({ to, kind: "existing" })),
}));

import { db } from "@/lib/server/db";
import { consumeOtp, issueOtp } from "@/lib/server/auth/otp";
import { activateVerifiedUser, checkLogin, startSignup } from "@/lib/server/auth/service";
import { rateLimit } from "@/lib/server/rate-limit";
import { resetTestDb } from "../support/db";

const email = "learner@example.com";

beforeEach(async () => {
  await resetTestDb();
  sent.length = 0;
});

describe("sign-up and OTP", () => {
  it("creates a pending user, emails a code, and stores only hashes", async () => {
    await startSignup({ name: "Ana", email, password: "secret123" });
    const user = await db.user.findUniqueOrThrow({ where: { emailNormalized: email } });
    expect(user.status).toBe("pending");
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain("secret123");
    const code = sent[0].code!;
    const otp = await db.authOtp.findFirstOrThrow({ where: { emailNormalized: email } });
    expect(otp.otpHash).not.toContain(code);
    expect(JSON.stringify(otp)).not.toContain(code);
  });

  it("verifies once; a reused code is rejected", async () => {
    await startSignup({ name: "Ana", email, password: "secret123" });
    const code = sent[0].code!;
    await consumeOtp(email, "signup", code);
    await expect(consumeOtp(email, "signup", code)).rejects.toMatchObject({ code: "INVALID_CODE" });
    const u = await activateVerifiedUser(email);
    expect(u.status).toBe("active");
    expect(u.emailVerifiedAt).not.toBeNull();
  });

  it("rejects wrong codes and locks after the attempt limit", async () => {
    await issueOtp(email, "signup", null);
    const code = sent[0].code!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(consumeOtp(email, "signup", wrong)).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(consumeOtp(email, "signup", code)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects expired codes", async () => {
    await issueOtp(email, "signup", null);
    await db.authOtp.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(consumeOtp(email, "signup", sent[0].code!)).rejects.toMatchObject({ code: "CODE_EXPIRED" });
  });

  it("enforces the resend cooldown and invalidates the previous code", async () => {
    await issueOtp(email, "signup", null);
    const r = await issueOtp(email, "signup", null);
    expect(sent).toHaveLength(1);
    expect(r.resendAfterSeconds).toBeGreaterThan(0);
    await db.authOtp.updateMany({ data: { lastSentAt: new Date(Date.now() - 120_000) } });
    await issueOtp(email, "signup", null);
    expect(sent).toHaveLength(2);
    await expect(consumeOtp(email, "signup", sent[0].code!)).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(consumeOtp(email, "signup", sent[1].code!)).resolves.toBeUndefined();
  });

  it("does not reveal existing accounts: a duplicate sign-up emails the owner instead", async () => {
    await startSignup({ name: "Ana", email, password: "secret123" });
    await consumeOtp(email, "signup", sent[0].code!);
    await activateVerifiedUser(email);
    sent.length = 0;
    const r = await startSignup({ name: "Mallory", email, password: "other1234" });
    expect(r.resendAfterSeconds).toBeGreaterThan(0);
    expect(sent).toEqual([{ to: email, kind: "existing" }]);
    const u = await db.user.findUniqueOrThrow({ where: { emailNormalized: email } });
    expect(u.displayName).toBe("Ana");
  });
});

describe("login", () => {
  it("accepts the right password and rejects others with one generic error", async () => {
    await startSignup({ name: "Ana", email, password: "secret123" });
    await consumeOtp(email, "signup", sent[0].code!);
    await activateVerifiedUser(email);
    await expect(checkLogin(email, "secret123")).resolves.toMatchObject({ kind: "ok" });
    await expect(checkLogin(email, "wrongpass1")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(checkLogin("nobody@example.com", "secret123")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("asks unverified users to verify (and sends a new code)", async () => {
    await startSignup({ name: "Ana", email, password: "secret123" });
    await db.authOtp.updateMany({ data: { lastSentAt: new Date(Date.now() - 120_000) } });
    await expect(checkLogin(email, "secret123")).resolves.toMatchObject({ kind: "needs_verification" });
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", async () => {
    for (let i = 0; i < 3; i++) await rateLimit("test", "1.2.3.4", 3, 60);
    await expect(rateLimit("test", "1.2.3.4", 3, 60)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(rateLimit("test", "5.6.7.8", 3, 60)).resolves.toBeUndefined();
  });
});
