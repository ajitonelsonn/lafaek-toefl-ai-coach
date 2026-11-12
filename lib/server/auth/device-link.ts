import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { Prisma, type DeviceLink } from "@prisma/client";
import { CODE_ALPHABET, CODE_LENGTH, normalizeCode } from "@/lib/utils/device-code";
import { db } from "../db";
import { requireEnv } from "../env";
import { ApiError } from "../http";
import { randomToken, sha256 } from "../crypto";

/**
 * Signing in another device without a password, in two directions:
 *
 * - share: a signed-in device shows a code and QR code; the other device enters or scans it and
 *   is signed in to the same account.
 * - request: a signed-out device (typically a headset, where typing is slow) shows a code and QR
 *   code; the learner scans it with a signed-in phone and approves, and the headset signs itself in.
 *
 * Codes work once, expire after a few minutes, and are stored only as an HMAC. Guessing is limited
 * per IP by the routes; with 31^8 possible codes and a 5–10 minute life, it is not practical.
 */
export const SHARE_TTL_MS = 5 * 60_000;
export const REQUEST_TTL_MS = 10 * 60_000;

const invalidCode = () => new ApiError(400, "INVALID_CODE", "That code is not correct or has expired. Check it, or make a new code.");

function newCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function hashCode(code: string): string {
  const { AUTH_SECRET } = requireEnv("AUTH_SECRET");
  return createHmac("sha256", AUTH_SECRET).update(`device-link:${code}`).digest("hex");
}

/** Creates a row with a fresh code, retrying on the (astronomically rare) clash with a stored code. */
async function createWithCode(data: Omit<Prisma.DeviceLinkUncheckedCreateInput, "codeHash">): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const code = newCode();
    try {
      await db.deviceLink.create({ data: { ...data, codeHash: hashCode(code) } });
      return code;
    } catch (e) {
      if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
}

/** A new share code for a signed-in learner. Any earlier unused share code of theirs stops working. */
export async function createShareCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
  await cancelShareCodes(userId);
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
  const code = await createWithCode({ kind: "share", userId, approvedAt: new Date(), expiresAt });
  return { code, expiresAt };
}

/** Called when the learner closes the code window, so a code nobody used does not stay valid. */
export async function cancelShareCodes(userId: string): Promise<void> {
  await db.deviceLink.updateMany({ where: { userId, kind: "share", consumedAt: null }, data: { consumedAt: new Date() } });
}

/** A signed-out device asks to be signed in. Only the asking device receives `secret`. */
export async function createRequest(userAgent: string | null): Promise<{ code: string; secret: string; expiresAt: Date }> {
  const secret = randomToken(32);
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);
  const code = await createWithCode({ kind: "request", pollSecretHash: sha256(secret), userAgent: userAgent?.slice(0, 300) ?? null, expiresAt });
  return { code, secret, expiresAt };
}

/** An unused, unexpired code, or INVALID_CODE (also for malformed input). */
export async function findLiveCode(input: string): Promise<DeviceLink> {
  const code = normalizeCode(input);
  if (!code) throw invalidCode();
  const link = await db.deviceLink.findUnique({ where: { codeHash: hashCode(code) } });
  if (!link || link.consumedAt || link.expiresAt <= new Date()) throw invalidCode();
  return link;
}

/** Uses a share code once and returns the account to sign in to. */
export async function consumeShare(link: DeviceLink): Promise<string> {
  if (link.kind !== "share" || !link.userId) throw invalidCode();
  const used = await db.deviceLink.updateMany({ where: { id: link.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
  if (used.count !== 1) throw invalidCode();
  return activeUserId(link.userId);
}

/** A signed-in learner approves a waiting device; the device signs itself in on its next poll. */
export async function approveRequest(link: DeviceLink, userId: string): Promise<void> {
  if (link.kind !== "request") throw invalidCode();
  const ok = await db.deviceLink.updateMany({
    where: { id: link.id, kind: "request", consumedAt: null, approvedAt: null, expiresAt: { gt: new Date() } },
    data: { userId, approvedAt: new Date() },
  });
  if (ok.count !== 1) throw invalidCode();
}

export type PollResult = { status: "pending" } | { status: "expired" } | { status: "approved"; userId: string };

/** The waiting device checks in. When approved, the request is used up and the account returned once. */
export async function pollRequest(secret: string): Promise<PollResult> {
  const link = await db.deviceLink.findUnique({ where: { pollSecretHash: sha256(secret) } });
  if (!link || link.consumedAt || link.expiresAt <= new Date()) return { status: "expired" };
  if (!link.approvedAt || !link.userId) return { status: "pending" };
  const used = await db.deviceLink.updateMany({ where: { id: link.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count !== 1) return { status: "expired" };
  try {
    return { status: "approved", userId: await activeUserId(link.userId) };
  } catch {
    return { status: "expired" };
  }
}

async function activeUserId(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (user?.status !== "active") throw invalidCode();
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return userId;
}

/** A plain name for the waiting device, shown to the person approving it. */
export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/OculusBrowser|Quest/i.test(ua)) return "Meta Quest browser";
  if (/iPhone|iPad/i.test(ua)) return "iPhone or iPad";
  if (/Android/i.test(ua)) return "Android device";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows computer";
  if (/CrOS|Linux/i.test(ua)) return "Computer";
  return "Unknown device";
}

/** Housekeeping: drop rows a day after they expire. */
export async function pruneDeviceLinks(): Promise<number> {
  return db.deviceLink.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } }).then((r) => r.count);
}
