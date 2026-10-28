import { z } from "zod";
import { json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { currentAudio } from "@/lib/server/practice";

const roleParam = z.string().regex(/^[a-z0-9]{1,12}$/i);

/** Latest audio files for one segment (e.g. ?role=r1), so the player can use S3 audio made after the page loaded. */
export const GET = route<{ itemId: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  const role = validate(roleParam, req.nextUrl.searchParams.get("role") ?? "");
  return json(await currentAudio(user.id, validate(uuidParam, params.itemId), role));
});
