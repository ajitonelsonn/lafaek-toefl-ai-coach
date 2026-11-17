import { NextResponse } from "next/server";
import { isGuestEmail } from "@/lib/server/auth/guest";
import { destroyCurrentSession, getAuth } from "@/lib/server/auth/session";

/** Where a guest may be sent after leaving: only our own pages, never another site. */
const NEXT = new Set(["/", "/signup", "/login", "/vr"]);

/**
 * A guest leaving the VR area: signs them out (a guest only exists to try the VR room), then
 * opens `next`. Real accounts are never signed out here, only redirected.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // A link prefetch (Next.js loads visible links ahead) must never sign the guest out.
  if (req.headers.get("next-router-prefetch") || req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch")) {
    return new NextResponse(null, { status: 204 });
  }
  const next = NEXT.has(url.searchParams.get("next") ?? "") ? url.searchParams.get("next")! : "/";
  const auth = await getAuth().catch(() => null);
  if (auth && isGuestEmail(auth.user.emailNormalized)) await destroyCurrentSession();
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
