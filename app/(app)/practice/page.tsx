import type { Metadata } from "next";
import Image from "next/image";
import { PracticeCenter } from "@/components/practice-center/PracticeCenter";
import { GenerationAutoRefresh } from "@/components/generation/GenerationAutoRefresh";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import { BRAND } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getProgress } from "@/lib/server/insights";
import { getBatchStatus } from "@/lib/server/generation/status";

export const metadata: Metadata = { title: "Practice Center" };

export default async function PracticeCenterPage({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  const { skill } = await searchParams;
  const initial = SKILLS.some((s) => s.id === skill) ? (skill as SkillId) : "all";
  const { user } = await requireAuthPage();
  const [progress, batch] = await Promise.all([getProgress(user.id), getBatchStatus(user.id)]);
  return (
    <div>
      <header className="mb-6 flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Practice <span className="text-primary">Center</span>
          </h1>
          <p className="mt-1.5 text-base text-muted sm:text-lg">
            Choose one of the 12 TOEFL practice types. Starter questions are ready now; personalised questions are added as they are generated.
          </p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <p className="max-w-36 text-right text-lg font-semibold italic leading-snug text-primary">Four skills. A brighter you!</p>
          <Image src={BRAND.mark.src} alt="" width={160} height={126} className="h-28 w-auto" priority />
        </div>
      </header>
      <GenerationAutoRefresh initial={batch} />
      <PracticeCenter key={initial} initialSkill={initial} byTask={progress.byTask} tasks={batch?.tasks ?? []} />
    </div>
  );
}
