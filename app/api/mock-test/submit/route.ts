import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { submitMockTest } from "@/lib/server/mock-test";
import { skillSchema } from "@/lib/validation/schemas";

const body = z.object({
  sections: z.array(skillSchema).min(1).max(4),
  durationSeconds: z.number().int().nonnegative(),
  answers: z.array(z.object({ itemId: z.string().uuid(), unitId: z.string().regex(/^[a-z]\d{0,2}$/), response: z.unknown() })).max(40),
});

export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const input = await parseBody(req, body, 64 * 1024);
  await rateLimit("mock-submit", user.id, 20, 3600);
  const r = await submitMockTest(user.id, input);
  return json({ resultId: r.id }, { status: 201 });
});
