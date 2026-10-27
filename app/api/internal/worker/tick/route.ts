import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/server/env";
import { tick, workerId } from "@/lib/server/generation/worker";

// Optional bounded drain for a cron trigger (e.g. Vercel Cron). The durable queue
// lives in PostgreSQL; this only processes a few jobs per call. Bearer-protected.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = env().WORKER_TICK_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Not allowed." } }, { status: 403 });
  }
  const processed = await tick(workerId(), 1);
  return NextResponse.json({ processed });
}
