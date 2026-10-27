import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getActivePlan } from "@/lib/server/study-plan";
import { getProgress } from "@/lib/server/insights";
import { getBatchStatus } from "@/lib/server/generation/status";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user } = await requireAuthPage();
  const [plan, progress, batch] = await Promise.all([getActivePlan(user.id), getProgress(user.id), getBatchStatus(user.id)]);
  // New learners set up their study plan first (spec: onboarding redirect).
  if (!plan && progress.questionsAttempted === 0) redirect("/study-plan");
  return <Dashboard userName={user.displayName} plan={plan} progress={progress} batch={batch} />;
}
