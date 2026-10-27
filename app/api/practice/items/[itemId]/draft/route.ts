import { z } from "zod";
import { json, parseBody, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { saveDraft } from "@/lib/server/practice";

const body = z.object({ to: z.string().max(100).optional(), subject: z.string().max(150).optional(), body: z.string().max(8000) });

export const PUT = route<{ itemId: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  await saveDraft(user.id, validate(uuidParam, params.itemId), await parseBody(req, body, 16 * 1024));
  return json({ status: "saved" });
});
