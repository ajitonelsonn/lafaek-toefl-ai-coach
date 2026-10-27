import { z } from "zod";
import { json, route, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getUsage } from "@/lib/server/insights";

export const GET = route(async (req) => {
  const { user } = await requireAuth();
  const range = validate(z.enum(["7d", "30d", "all"]).default("30d"), req.nextUrl.searchParams.get("range") ?? undefined);
  return json({ usage: await getUsage(user.id, range) });
});
