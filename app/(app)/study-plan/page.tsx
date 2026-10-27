import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { StudyPlanPage } from "@/components/study-plan/StudyPlanPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getActivePlan } from "@/lib/server/study-plan";
import { getBatchStatus } from "@/lib/server/generation/status";
import { getProgress } from "@/lib/server/insights";

export const metadata: Metadata = { title: "Study Plan" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const [plan, batch, progress] = await Promise.all([getActivePlan(user.id), getBatchStatus(user.id), getProgress(user.id)]);
  return (
    <>
      <PageHeader title="Study Plan" description="Create a study plan to reach your TOEFL goals." icon="calendar" art={ILLUSTRATIONS.headerStudyPlan} />
      <StudyPlanPage plan={plan} batch={batch} progress={progress} />
    </>
  );
}
