import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { MockTestResults } from "@/components/mock-test/MockTestResults";

export const metadata: Metadata = { title: "Mock Test Results" };

export default function Page() {
  return (
    <>
      <PageHeader title="Mock Test Results" description="See how you did in each section." icon="score" />
      <MockTestResults />
    </>
  );
}
