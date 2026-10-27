import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressPage } from "@/components/progress/ProgressPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Progress" };

export default function Page() {
  return (
    <>
      <PageHeader title="Progress" description="Track your practice and see your improvement." icon="progress" art={ILLUSTRATIONS.headerProgress} />
      <ProgressPage />
    </>
  );
}
