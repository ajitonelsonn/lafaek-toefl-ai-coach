import { z } from "zod";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { getActivePlan, savePlan } from "@/lib/server/study-plan";
import { studyPlanInputSchema } from "@/lib/validation/schemas";

export const GET = route(async () => {
  const { user } = await requireAuth();
  return json({ plan: await getActivePlan(user.id) });
});

const body = z.object({ input: studyPlanInputSchema, confirmNewVersion: z.boolean().default(false) });

export const POST = route(async (req) => {
  const { user } = await requireAuth();
  const { input, confirmNewVersion } = await parseBody(req, body);
  return json({ plan: await savePlan(user.id, input, confirmNewVersion) }, { status: 201 });
});
