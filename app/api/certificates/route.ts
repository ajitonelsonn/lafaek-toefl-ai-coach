import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { issueCertificate } from "@/lib/server/certificates";
import { mockResult } from "@/lib/server/mock-test";

const body = z.object({ resultId: z.string().uuid() });

/** Issues the certificate for one of the learner's qualifying mock tests (idempotent). */
export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const { resultId } = await parseBody(req, body, 1024);
  await rateLimit("certificate-issue", user.id, 20, 3600);
  const c = await issueCertificate(user.id, await mockResult(user.id, resultId));
  return json({ code: c.code }, { status: 201 });
});
