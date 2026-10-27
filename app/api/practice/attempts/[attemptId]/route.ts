import { db } from "@/lib/server/db";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";

export const GET = route<{ attemptId: string }>(async (_req, { params }) => {
  const { user } = await requireAuth();
  const attempt = await db.practiceAttempt.findFirst({
    where: { id: validate(uuidParam, params.attemptId), userId: user.id },
    select: { id: true, taskSlug: true, unitId: true, responseJson: true, scoreJson: true, feedbackJson: true, submittedAt: true, scoringVersion: true },
  });
  if (!attempt) throw new ApiError(404, "NOT_FOUND", "This attempt was not found.");
  return json({ attempt });
});
