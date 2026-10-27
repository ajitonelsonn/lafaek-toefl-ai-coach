import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getProgress } from "@/lib/server/insights";

export const GET = route(async () => {
  const { user } = await requireAuth();
  return json({ progress: await getProgress(user.id) });
});
