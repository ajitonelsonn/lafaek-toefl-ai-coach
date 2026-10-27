import { z } from "zod";
import { json, parseBody, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { submitResponses } from "@/lib/server/practice";

const body = z.object({
  responses: z.array(z.object({ unitId: z.string().regex(/^[a-z]\d{0,2}$/), response: z.unknown() })).min(1).max(20),
  durationMs: z.number().int().nonnegative().optional(),
});

export const POST = route<{ itemId: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  const itemId = validate(uuidParam, params.itemId);
  const input = await parseBody(req, body, 32 * 1024);
  await rateLimit("submit", user.id, 240, 600);
  return json({ results: await submitResponses(user.id, itemId, input.responses, input.durationMs) });
});
