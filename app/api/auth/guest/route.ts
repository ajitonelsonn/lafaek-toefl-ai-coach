import { clientIp, json, route } from "@/lib/server/http";
import { createGuest } from "@/lib/server/auth/guest";
import { createSession, getAuth } from "@/lib/server/auth/session";

/**
 * "Try the demo": signs the visitor in as a new guest, so they can enter the VR Study Room without
 * creating an account. Someone who is already signed in keeps their own session.
 */
export const POST = route(async (req) => {
  if (await getAuth()) return json({ ok: true, next: "/vr/room" });
  const userId = await createGuest(clientIp(req));
  await createSession(userId, req.headers.get("user-agent"));
  return json({ ok: true, next: "/vr/room" });
});
