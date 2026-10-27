import type { Metadata } from "next";
import Image from "next/image";
import { PracticeCenter } from "@/components/practice-center/PracticeCenter";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import { BRAND } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Practice Center" };

export default async function PracticeCenterPage({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  const { skill } = await searchParams;
  const initial = SKILLS.some((s) => s.id === skill) ? (skill as SkillId) : "all";
  return (
    <div>
      <header className="mb-6 flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Practice <span className="text-primary">Center</span>
          </h1>
          <p className="mt-1.5 text-base text-muted sm:text-lg">
            Choose one of the 12 TOEFL practice types. Each has a set of sample questions you can try now.
          </p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <p className="max-w-36 text-right text-lg font-semibold italic leading-snug text-primary">Four skills. A brighter you!</p>
          <Image src={BRAND.mark.src} alt="" width={160} height={126} className="h-28 w-auto" priority />
        </div>
      </header>
      <PracticeCenter key={initial} initialSkill={initial} />
    </div>
  );
}
