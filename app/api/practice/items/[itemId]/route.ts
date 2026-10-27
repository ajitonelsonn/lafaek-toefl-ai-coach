import { json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getOwnedItem } from "@/lib/server/practice";
import { buildView } from "@/lib/server/content/view";
import type { PracticeSlug } from "@/lib/config/practice-types";

export const GET = route<{ itemId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const item = await getOwnedItem(user.id, validate(uuidParam, params.itemId));
  return json({ view: buildView(item.taskSlug as PracticeSlug, [item]) });
});
