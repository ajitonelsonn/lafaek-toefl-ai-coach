import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { latestMockResult } from "@/lib/server/mock-test";

export const GET = route(async () => {
  const { user } = await requireAuth();
  return json({ result: await latestMockResult(user.id) });
});
