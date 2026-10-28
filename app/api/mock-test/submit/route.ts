import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { submitMockTest } from "@/lib/server/mock-test";

const body = z.object({
  /** Signed form from the session page; only its questions are scored, once. */
  token: z.string().min(20).max(8000),
  durationSeconds: z.number().int().nonnegative(),
  answers: z.array(z.object({ itemId: z.string().uuid(), unitId: z.string().regex(/^[a-z]\d{0,2}$/), response: z.unknown() })).max(150),
});

export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const input = await parseBody(req, body, 64 * 1024);
  await rateLimit("mock-submit", user.id, 20, 3600);
  const r = await submitMockTest(user.id, input);
  return json({ resultId: r.id }, { status: 201 });
});
