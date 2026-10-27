import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";

export const GET = route(async () => {
  const { user } = await requireAuth();
  const rows = await db.vocabularyProgress.findMany({ where: { userId: user.id } });
  return json({ progress: Object.fromEntries(rows.map((r) => [r.wordId, { status: r.status ?? undefined, bookmarked: r.bookmarked }])) });
});
