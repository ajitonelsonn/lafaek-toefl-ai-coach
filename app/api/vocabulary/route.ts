import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { listVocabulary, vocabularyPending, vocabularyProgress } from "@/lib/server/vocabulary";

export const GET = route(async () => {
  const { user } = await requireAuth();
  const [words, progress, pending] = await Promise.all([listVocabulary(user.id), vocabularyProgress(user.id), vocabularyPending(user.id)]);
  return json({ words, progress, pending });
});
