import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http";
import { randomToken, sha256 } from "../crypto";
import { describeDevice, type DeviceKind } from "@/lib/utils/user-agent";
import { MAX_DEVICES } from "@/lib/utils/device-code";

const isProd = () => env().NODE_ENV === "production";
/** `__Host-` requires Secure, Path=/ and no Domain, which we always set in production. */
export const SESSION_COOKIE = () => (isProd() ? "__Host-lafaek_session" : "lafaek_session");

export interface AuthContext {
  user: Pick<User, "id" | "emailNormalized" | "displayName" | "role" | "createdAt">;
  sessionId: string;
}

export { MAX_DEVICES };

/**
 * Signs this browser in. If that puts the account over MAX_DEVICES, the devices used longest ago
 * are signed out, so a new sign-in always works and nobody is locked out.
 */
export async function createSession(userId: string, userAgent: string | null): Promise<void> {
  const token = randomToken(32);
  const days = env().SESSION_TTL_DAYS;
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await db.session.create({
    data: { userId, sessionTokenHash: sha256(token), expiresAt, userAgent: userAgent?.slice(0, 180) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE(), token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  await enforceDeviceLimit(userId);
}

const activeWhere = (userId: string) => ({ userId, revokedAt: null, expiresAt: { gt: new Date() } });
/** Most recently used first; the new session (lastSeenAt = now) is always among the kept ones. */
const recentFirst = [{ lastSeenAt: "desc" as const }, { createdAt: "desc" as const }];

async function enforceDeviceLimit(userId: string): Promise<void> {
  const extra = await db.session.findMany({ where: activeWhere(userId), orderBy: recentFirst, skip: MAX_DEVICES, select: { id: true } });
  if (extra.length) await db.session.updateMany({ where: { id: { in: extra.map((x) => x.id) }, revokedAt: null }, data: { revokedAt: new Date() } });
}

export interface DeviceUsage {
  count: number;
  max: number;
  /** At the limit: the device the next sign-in would sign out. */
  willSignOut: string | null;
}

export async function deviceUsage(userId: string): Promise<DeviceUsage> {
  const sessions = await db.session.findMany({ where: activeWhere(userId), orderBy: recentFirst, select: { userAgent: true } });
  const oldest = sessions.length >= MAX_DEVICES ? sessions[MAX_DEVICES - 1] : null;
  return { count: Math.min(sessions.length, MAX_DEVICES), max: MAX_DEVICES, willSignOut: oldest ? describeDevice(oldest.userAgent).label : null };
}

export interface SignedInDevice {
  id: string;
  label: string;
  kind: DeviceKind;
  current: boolean;
  signedInAt: string;
  lastActiveAt: string;
}

/** The account's signed-in devices, most recently used first. */
export async function listDevices(userId: string, currentSessionId: string): Promise<SignedInDevice[]> {
  const sessions = await db.session.findMany({ where: activeWhere(userId), orderBy: recentFirst, take: MAX_DEVICES + 5 });
  return sessions.map((x) => {
    const { label, kind } = describeDevice(x.userAgent);
    return { id: x.id, label, kind, current: x.id === currentSessionId, signedInAt: x.createdAt.toISOString(), lastActiveAt: x.lastSeenAt.toISOString() };
  });
}

/** Signs one of the learner's own devices out. Returns false if it was not theirs or already out. */
export async function revokeDevice(userId: string, sessionId: string): Promise<boolean> {
  const r = await db.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count === 1;
}

export async function revokeOtherDevices(userId: string, currentSessionId: string): Promise<number> {
  const r = await db.session.updateMany({ where: { userId, revokedAt: null, id: { not: currentSessionId } }, data: { revokedAt: new Date() } });
  return r.count;
}

/** Revokes the session in the current cookie (if any) and clears the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE())?.value;
  if (token) {
    await db.session.updateMany({ where: { sessionTokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  jar.delete(SESSION_COOKIE());
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Current session, memoised per request. Returns null when signed out. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE())?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { sessionTokenHash: sha256(token) },
    include: { user: { select: { id: true, emailNormalized: true, displayName: true, role: true, status: true, createdAt: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== "active") return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  const { status: _status, ...user } = session.user;
  void _status;
  return { user, sessionId: session.id };
});

/** For route handlers: 401 when signed out. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, "UNAUTHENTICATED", "Please log in to continue.");
  return auth;
}

export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (auth.user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "You do not have access to this.");
  return auth;
}

/** For server components: redirect to /login when signed out. */
export async function requireAuthPage(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}
