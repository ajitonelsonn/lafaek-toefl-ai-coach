import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { StudyPlanPage } from "@/components/study-plan/StudyPlanPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Study Plan" };

export default function Page() {
  return (
    <>
      <PageHeader title="Study Plan" description="Create a study plan to reach your TOEFL goals." icon="calendar" art={ILLUSTRATIONS.headerStudyPlan} />
      <StudyPlanPage />
    </>
  );
}
