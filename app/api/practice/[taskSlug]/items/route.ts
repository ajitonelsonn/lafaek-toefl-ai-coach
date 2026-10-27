import { z } from "zod";
import { json, route, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { assertSlug, getPracticeSet } from "@/lib/server/practice";

export const GET = route<{ taskSlug: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  const slug = assertSlug(params.taskSlug);
  const cursor = validate(z.string().uuid().optional(), req.nextUrl.searchParams.get("cursor") ?? undefined);
  return json(await getPracticeSet(user.id, slug, cursor));
});
