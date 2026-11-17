import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { destroyCurrentSession, requireAuth, revokeDevice } from "@/lib/server/auth/session";

/** Signs one of the learner's devices out. Signing out this device also clears its cookie. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const auth = await requireAuth();
  const id = validate(uuidParam, params.id);
  if (id === auth.sessionId) {
    await destroyCurrentSession();
    return json({ status: "signed_out", current: true });
  }
  if (!(await revokeDevice(auth.user.id, id))) throw new ApiError(404, "NOT_FOUND", "That device is already signed out.");
  return json({ status: "signed_out", current: false });
});
