import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getBatchStatus } from "@/lib/server/generation/status";

export const GET = route(async () => {
  const { user } = await requireAuth();
  return json({ batch: await getBatchStatus(user.id) });
});
