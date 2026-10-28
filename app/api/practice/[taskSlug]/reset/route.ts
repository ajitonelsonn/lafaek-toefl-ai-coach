import { json, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { assertSlug, resetPractice } from "@/lib/server/practice";

/** "Start over" for one practice type: earlier answers stay in the history but no longer count as done. */
export const POST = route<{ taskSlug: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  await resetPractice(user.id, assertSlug(params.taskSlug));
  return json({ ok: true });
});
