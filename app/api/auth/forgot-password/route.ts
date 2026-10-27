import { clientIp, json, parseBody, route } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { env } from "@/lib/server/env";
import { resendSchema } from "@/lib/validation/schemas";

// No self-service reset in this version: the response never reveals whether the
// account exists, and points to the configured administrator contact (if any).
export const POST = route(async (req) => {
  await parseBody(req, resendSchema);
  await rateLimit("forgot-ip", clientIp(req), 10, 3600);
  return json({ status: "contact_admin", adminContact: env().ADMIN_CONTACT_EMAIL ?? null });
});
