import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { MockTestIntro } from "@/components/mock-test/MockTestIntro";
import { ILLUSTRATIONS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Mock Test" };

export default function Page() {
  return (
    <>
      <PageHeader title="Mock Test" description="Take a TOEFL practice test to check your readiness." icon="goal" art={ILLUSTRATIONS.headerMockTest} />
      <MockTestIntro />
    </>
  );
}
