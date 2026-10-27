import { z } from "zod";
import { db } from "@/lib/server/db";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth/session";
import { grantBoostPacks } from "@/lib/server/credits";

const body = z.object({ email: z.string().trim().email().max(254), packs: z.number().int().min(1).max(20).default(1), note: z.string().trim().max(300).optional() });

/** Admin: add Boost Packs to an account after payment was arranged (audited). */
export const POST = route(async (req) => {
  const { user } = await requireAdmin();
  const input = await parseBody(req, body);
  const r = await grantBoostPacks({ ...input, grantedBy: `admin:${user.id}` });
  await db.adminAuditEvent.create({ data: { adminUserId: user.id, action: "credits.grant", targetType: "user", targetId: r.userId, safeMetadataJson: { packs: input.packs, added: r.added } } });
  return json(r, { status: 201 });
});
