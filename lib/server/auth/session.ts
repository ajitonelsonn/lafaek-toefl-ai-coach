import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { ApiError } from "../http";
import { randomToken, sha256 } from "../crypto";

const isProd = () => env().NODE_ENV === "production";
/** `__Host-` requires Secure, Path=/ and no Domain, which we always set in production. */
export const SESSION_COOKIE = () => (isProd() ? "__Host-lafaek_session" : "lafaek_session");

export interface AuthContext {
  user: Pick<User, "id" | "emailNormalized" | "displayName" | "role" | "createdAt">;
  sessionId: string;
}

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
