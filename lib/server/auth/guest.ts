import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";

/**
 * Guest demo: lets a visitor try the VR Study Room without an account. A guest is a normal user row
 * with no password, no credits and a reserved email domain, so every existing route keeps working.
 * Guests practise with a read-only view of one demo account's questions (DEMO_CONTENT_EMAIL) and
 * keep their own separate answers and progress. Spoken answers and AI scores are capped per guest
 * and across all guests, because each one costs an AI call. Old guests are deleted by the worker.
 */
const GUEST_DOMAIN = "guest.lafaektoefl.invalid";
const GUEST_TTL_MS = 48 * 60 * 60_000;

export const isGuestEmail = (email: string) => email.endsWith(`@${GUEST_DOMAIN}`);

let demoOwner: { id: string | null; at: number } | null = null;

/** The account whose questions guests see, or null when the guest demo is not configured. */
export async function demoOwnerId(): Promise<string | null> {
  if (demoOwner && Date.now() - demoOwner.at < 5 * 60_000) return demoOwner.id;
  const email = env().DEMO_CONTENT_EMAIL?.toLowerCase();
  const user = email ? await db.user.findFirst({ where: { emailNormalized: email, status: "active" }, select: { id: true } }) : null;
  demoOwner = { id: user?.id ?? null, at: Date.now() };
  return demoOwner.id;
}

export const guestDemoEnabled = async () => (await demoOwnerId()) !== null;

const guestIds = new Map<string, boolean>();

/** For a guest, the demo account whose questions they may also see; null for everyone else. */
export async function sharedContentOwner(userId: string): Promise<string | null> {
  let guest = guestIds.get(userId);
  if (guest === undefined) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { emailNormalized: true } });
    guest = !!user && isGuestEmail(user.emailNormalized);
    if (guestIds.size > 5000) guestIds.clear();
    guestIds.set(userId, guest);
  }
  return guest ? demoOwnerId() : null;
}

/** Creates a guest account. Limited per visitor and per day, so it cannot be used to flood the database. */
export async function createGuest(ip: string): Promise<string> {
  if (!(await guestDemoEnabled())) throw new ApiError(404, "NOT_FOUND", "The demo is not available right now.");
  await rateLimit("guest-create-ip", ip, 6, 3600);
  await rateLimit("guest-create-all", "all", 500, 86400);
  const user = await db.user.create({
    data: {
      emailNormalized: `guest-${randomUUID()}@${GUEST_DOMAIN}`,
      displayName: "Guest",
      status: "active",
      emailVerifiedAt: new Date(),
      planCredits: 0,
      mockCredits: 0,
    },
    select: { id: true },
  });
  return user.id;
}

/**
 * Extra limits for a guest's spoken answers and AI scores (each costs an AI call). No-op for
 * real accounts, which have their own limits.
 */
export async function limitGuestAi(user: { id: string; emailNormalized: string }, kind: "speaking" | "feedback"): Promise<void> {
  if (!isGuestEmail(user.emailNormalized)) return;
  const [perGuest, allGuests] = kind === "speaking" ? [12, 400] : [8, 250];
  try {
    await rateLimit(`guest-${kind}`, user.id, perGuest, 86400);
    await rateLimit(`guest-${kind}-all`, "all", allGuests, 86400);
  } catch {
    throw new ApiError(429, "RATE_LIMITED", "The demo has a limit on spoken answers and AI scores. Create a free account to keep practising.");
  }
}

/** Deletes guest accounts older than two days, with their sessions, answers and progress. */
export async function pruneGuests(): Promise<number> {
  const { count } = await db.user.deleteMany({ where: { emailNormalized: { endsWith: `@${GUEST_DOMAIN}` }, createdAt: { lt: new Date(Date.now() - GUEST_TTL_MS) } } });
  return count;
}
