import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getCatalog } from "@/lib/server/practice";

export const GET = route(async () => {
  const { user } = await requireAuth();
  return json({ tasks: await getCatalog(user.id) });
});
