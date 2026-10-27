import { json, route } from "@/lib/server/http";
import { getAuth } from "@/lib/server/auth/session";

export const GET = route(async () => {
  const auth = await getAuth();
  return json({
    user: auth ? { id: auth.user.id, name: auth.user.displayName, email: auth.user.emailNormalized, role: auth.user.role } : null,
  });
});
