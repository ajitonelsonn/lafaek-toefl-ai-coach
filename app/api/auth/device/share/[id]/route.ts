import { json, parseBody, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { decideShare, shareStatus } from "@/lib/server/auth/device-link";
import { deviceDecisionSchema } from "@/lib/validation/schemas";

/** The code window polls this: still waiting, a device asking to sign in, or done. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const auth = await requireAuth();
  return json(await shareStatus(auth.user.id, validate(uuidParam, params.id)));
});

/** Approve or deny the device that entered the code. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const auth = await requireAuth();
  const id = validate(uuidParam, params.id);
  const { approve } = await parseBody(req, deviceDecisionSchema);
  await decideShare(auth.user.id, id, approve);
  return json({ status: approve ? "approved" : "denied" });
});
