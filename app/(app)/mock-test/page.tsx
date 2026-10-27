import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { MockTestIntro } from "@/components/mock-test/MockTestIntro";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getCredits } from "@/lib/server/credits";
import { latestMockResult, mockStatus } from "@/lib/server/mock-test";

export const metadata: Metadata = { title: "Mock Test" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const [latest, status, credits] = await Promise.all([latestMockResult(user.id), mockStatus(user.id), getCredits(user.id)]);
  return (
    <>
      <PageHeader title="Mock Test" description="Take a TOEFL practice test to check your readiness." icon="goal" art={ILLUSTRATIONS.headerMockTest} />
      <MockTestIntro latest={latest} active={status.active} credits={credits} />
    </>
  );
}
