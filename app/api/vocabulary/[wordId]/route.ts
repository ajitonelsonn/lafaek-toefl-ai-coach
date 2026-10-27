import { z } from "zod";
import { db } from "@/lib/server/db";
import { ApiError, json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { VOCABULARY } from "@/lib/content/vocabulary";

const body = z.object({ status: z.enum(["known", "review"]).nullable().optional(), bookmarked: z.boolean().optional() });

export const PUT = route<{ wordId: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  if (!VOCABULARY.some((w) => w.id === params.wordId)) throw new ApiError(404, "NOT_FOUND", "Unknown word.");
  const b = await parseBody(req, body);
  const data = { ...(b.status !== undefined ? { status: b.status } : {}), ...(b.bookmarked !== undefined ? { bookmarked: b.bookmarked } : {}) };
  const row = await db.vocabularyProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId: params.wordId } },
    create: { userId: user.id, wordId: params.wordId, ...data },
    update: data,
  });
  return json({ progress: { status: row.status ?? undefined, bookmarked: row.bookmarked } });
});
