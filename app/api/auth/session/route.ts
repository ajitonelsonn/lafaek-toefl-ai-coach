import { json, route } from "@/lib/server/http";
import { getAuth } from "@/lib/server/auth/session";
import { guestDemoEnabled, isGuestEmail } from "@/lib/server/auth/guest";

export const GET = route(async () => {
  const auth = await getAuth();
  if (!auth) return json({ user: null, guestDemo: await guestDemoEnabled() });
  const guest = isGuestEmail(auth.user.emailNormalized);
  return json({
    // A guest's placeholder address is never shown.
    user: { id: auth.user.id, name: auth.user.displayName, email: guest ? null : auth.user.emailNormalized, role: auth.user.role, guest },
  });
});
