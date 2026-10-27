import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressPage } from "@/components/progress/ProgressPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getProgress } from "@/lib/server/insights";
import { getActivePlan } from "@/lib/server/study-plan";

export const metadata: Metadata = { title: "Progress" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const [progress, plan] = await Promise.all([getProgress(user.id), getActivePlan(user.id)]);
  return (
    <>
      <PageHeader title="Progress" description="Track your practice and see your improvement." icon="progress" art={ILLUSTRATIONS.headerProgress} />
      <ProgressPage progress={progress} targetScore={plan?.input.targetScore ?? null} />
    </>
  );
}
