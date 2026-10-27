import { json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { wordAudioUrl } from "@/lib/server/vocabulary";

// POST (not GET): the first call creates the audio. Owner-only; returns a short-lived signed URL.
export const POST = route<{ wordId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  return json(await wordAudioUrl(user.id, validate(uuidParam, params.wordId)));
});
