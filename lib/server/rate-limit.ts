import "server-only";
import { db } from "./db";
import { ApiError } from "./http";
import { sha256 } from "./crypto";

/**
 * Fixed-window rate limiter stored in PostgreSQL, so it works across
 * serverless instances. Keys are hashed (no raw emails/IPs stored).
 */
export async function rateLimit(name: string, identifier: string, limit: number, windowSeconds: number): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = `${name}:${sha256(identifier).slice(0, 32)}`;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`;
  if ((rows[0]?.count ?? 0) > limit) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
  }
}

export async function pruneRateLimits(): Promise<number> {
  return db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86_400_000) } } }).then((r) => r.count);
}
