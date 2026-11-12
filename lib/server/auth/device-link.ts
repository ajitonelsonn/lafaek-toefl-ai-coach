import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { CODE_ALPHABET, CODE_LENGTH, normalizeCode } from "@/lib/utils/device-code";
import { describeDevice } from "@/lib/utils/user-agent";
import { db } from "../db";
import { requireEnv } from "../env";
import { ApiError } from "../http";
import { randomToken, sha256 } from "../crypto";

export { describeDevice };

/**
 * Signing in another device (a Meta Quest, a phone) without a password:
 *
 * 1. On a signed-in device the learner opens "Sign in on Quest": it shows a code and QR code.
 * 2. The new device enters or scans the code. That only *claims* it: the new device now waits.
 * 3. The signed-in device shows "Meta Quest browser wants to sign in" and the learner taps Approve
 *    (or Deny). Nothing is signed in without that tap, so a code someone saw or guessed is useless.
 * 4. The new device, polling with a secret only it holds, is signed in.
 *
 * A code can be claimed by one device only, works once, expires after a few minutes and is stored
 * only as an HMAC. Guessing is also limited per IP by the routes.
 */
export const SHARE_TTL_MS = 5 * 60_000;
/** Once a device has claimed a code, the learner has at least this long to approve it. */
export const APPROVE_WINDOW_MS = 3 * 60_000;

const invalidCode = () => new ApiError(400, "INVALID_CODE", "That code is not correct or has expired. Check it, or make a new code on your signed-in device.");

function newCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function hashCode(code: string): string {
  const { AUTH_SECRET } = requireEnv("AUTH_SECRET");
  return createHmac("sha256", AUTH_SECRET).update(`device-link:${code}`).digest("hex");
}

/** Step 1: a new code for a signed-in learner. Their earlier code that nobody approved stops working. */
export async function createShareCode(userId: string): Promise<{ id: string; code: string; expiresAt: Date }> {
  await cancelShareCodes(userId);
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
  // Retry on the (astronomically rare) clash with a stored code.
  for (let attempt = 0; ; attempt++) {
    const code = newCode();
    try {
      const link = await db.deviceLink.create({ data: { kind: "share", userId, codeHash: hashCode(code), expiresAt } });
      return { id: link.id, code, expiresAt };
    } catch (e) {
      if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
}

/** The code window was closed: codes not yet approved stop working (an approved one still completes). */
export async function cancelShareCodes(userId: string): Promise<void> {
  await db.deviceLink.updateMany({ where: { userId, kind: "share", consumedAt: null, approvedAt: null }, data: { consumedAt: new Date() } });
}

/** Step 2: the new device enters the code. Returns the secret it polls with; nothing is signed in yet. */
export async function claimCode(input: string, userAgent: string | null): Promise<{ secret: string; expiresAt: Date }> {
  const code = normalizeCode(input);
  if (!code) throw invalidCode();
  const link = await db.deviceLink.findUnique({ where: { codeHash: hashCode(code) } });
  const now = new Date();
  if (!link || link.kind !== "share" || link.consumedAt || link.pollSecretHash || link.expiresAt <= now) throw invalidCode();
  const secret = randomToken(32);
  const expiresAt = new Date(Math.max(link.expiresAt.getTime(), now.getTime() + APPROVE_WINDOW_MS));
  // Only the first device to claim the code wins.
  const claimed = await db.deviceLink.updateMany({
    where: { id: link.id, consumedAt: null, pollSecretHash: null, expiresAt: { gt: now } },
    data: { pollSecretHash: sha256(secret), userAgent: userAgent?.slice(0, 300) ?? null, expiresAt },
  });
  if (claimed.count !== 1) throw invalidCode();
  return { secret, expiresAt };
}

export type ShareStatus =
  | { status: "waiting"; expiresAt: string }
  | { status: "claimed"; device: string; expiresAt: string }
  | { status: "approved" }
  | { status: "signed_in"; device: string }
  | { status: "denied" }
  | { status: "expired" };

/** What the signed-in device's code window shows: still waiting, a device to approve, or done. */
export async function shareStatus(userId: string, id: string): Promise<ShareStatus> {
  const link = await db.deviceLink.findFirst({ where: { id, userId, kind: "share" } });
  if (!link) return { status: "expired" };
  const device = describeDevice(link.userAgent).label;
  if (link.approvedAt) return link.consumedAt ? { status: "signed_in", device } : link.expiresAt > new Date() ? { status: "approved" } : { status: "expired" };
  if (link.consumedAt) return { status: "denied" };
  if (link.expiresAt <= new Date()) return { status: "expired" };
  return link.pollSecretHash ? { status: "claimed", device, expiresAt: link.expiresAt.toISOString() } : { status: "waiting", expiresAt: link.expiresAt.toISOString() };
}

/** Step 3: the learner approves (or denies) the device that claimed their code. */
export async function decideShare(userId: string, id: string, approve: boolean): Promise<void> {
  const ok = await db.deviceLink.updateMany({
    where: { id, userId, kind: "share", pollSecretHash: { not: null }, approvedAt: null, consumedAt: null, expiresAt: { gt: new Date() } },
    data: approve ? { approvedAt: new Date() } : { consumedAt: new Date() },
  });
  if (ok.count !== 1) throw new ApiError(400, "CODE_EXPIRED", "This sign-in request has expired. Make a new code.");
}

export type PollResult = { status: "pending" } | { status: "denied" } | { status: "expired" } | { status: "approved"; userId: string };

/** Step 4: the waiting device checks in. Once approved, the code is used up and the account returned once. */
export async function pollClaim(secret: string): Promise<PollResult> {
  const link = await db.deviceLink.findUnique({ where: { pollSecretHash: sha256(secret) } });
  if (!link || !link.userId) return { status: "expired" };
  if (link.consumedAt) return { status: link.approvedAt ? "expired" : "denied" };
  if (link.expiresAt <= new Date()) return { status: "expired" };
  if (!link.approvedAt) return { status: "pending" };
  const used = await db.deviceLink.updateMany({ where: { id: link.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count !== 1) return { status: "expired" };
  const user = await db.user.findUnique({ where: { id: link.userId }, select: { status: true } });
  if (user?.status !== "active") return { status: "expired" };
  await db.user.update({ where: { id: link.userId }, data: { lastLoginAt: new Date() } });
  return { status: "approved", userId: link.userId };
}

/** Housekeeping: drop rows a day after they expire. */
export async function pruneDeviceLinks(): Promise<number> {
  return db.deviceLink.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } }).then((r) => r.count);
}
