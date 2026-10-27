import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { MockTestIntro } from "@/components/mock-test/MockTestIntro";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { MOCK_FORM, latestMockResult } from "@/lib/server/mock-test";
import type { SkillId } from "@/lib/config/practice-types";

export const metadata: Metadata = { title: "Mock Test" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const latest = await latestMockResult(user.id);
  const unitsPerSkill = MOCK_FORM.reduce((acc, f) => ({ ...acc, [f.skill]: (acc[f.skill] ?? 0) + f.units.length }), {} as Record<SkillId, number>);
  return (
    <>
      <PageHeader title="Mock Test" description="Take a TOEFL practice test to check your readiness." icon="goal" art={ILLUSTRATIONS.headerMockTest} />
      <MockTestIntro latest={latest} unitsPerSkill={unitsPerSkill} />
    </>
  );
}
