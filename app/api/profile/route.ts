import { z } from "zod";
import { db } from "@/lib/server/db";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { nameSchema } from "@/lib/validation/schemas";

export const GET = route(async () => {
  const { user } = await requireAuth();
  return json({ profile: { name: user.displayName, email: user.emailNormalized, createdAt: user.createdAt.toISOString() } });
});

export const PATCH = route(async (req) => {
  const { user } = await requireAuth();
  const { name } = await parseBody(req, z.object({ name: nameSchema }));
  const u = await db.user.update({ where: { id: user.id }, data: { displayName: name }, select: { displayName: true, emailNormalized: true, createdAt: true } });
  return json({ profile: { name: u.displayName, email: u.emailNormalized, createdAt: u.createdAt.toISOString() } });
});
