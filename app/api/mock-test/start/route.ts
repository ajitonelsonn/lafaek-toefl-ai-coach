import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { startMockTest } from "@/lib/server/mock-test";
import { skillSchema } from "@/lib/validation/schemas";

const body = z.object({ sections: z.array(skillSchema).min(1).max(4) });

/** Starts (or resumes) a mock test. Uses one lifetime mock credit; 402 when none are left. */
export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const { sections } = await parseBody(req, body);
  await rateLimit("mock-start", user.id, 20, 3600);
  return json(await startMockTest(user.id, sections), { status: 201 });
});
