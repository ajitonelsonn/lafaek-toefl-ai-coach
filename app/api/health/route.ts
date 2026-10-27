import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { features } from "@/lib/server/env";

// Non-sensitive service health only (no versions, hosts or error details).
export async function GET() {
  const database = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  return NextResponse.json(
    { status: database ? "ok" : "degraded", database, features: { email: features.email(), storage: features.storage(), ai: features.metaText(), speech: features.tts() } },
    { status: database ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
