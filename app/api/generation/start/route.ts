import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { startInitialBatch } from "@/lib/server/generation/queue";
import { getBatchStatus } from "@/lib/server/generation/status";

const body = z.object({ idempotencyKey: z.string().uuid() });

// Returns immediately; the worker does the generation in the background.
export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const { idempotencyKey } = await parseBody(req, body);
  await rateLimit("generation-start", user.id, 10, 3600);
  const batch = await startInitialBatch(user.id, idempotencyKey);
  return json({ batch: await getBatchStatus(user.id, batch.id) }, { status: 202 });
});
