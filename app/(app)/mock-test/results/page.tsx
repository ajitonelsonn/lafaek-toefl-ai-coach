import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { MockTestResults } from "@/components/mock-test/MockTestResults";
import { requireAuthPage } from "@/lib/server/auth/session";
import { mockHistory } from "@/lib/server/mock-test";

export const metadata: Metadata = { title: "Mock Test Results" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const history = await mockHistory(user.id);
  return (
    <>
      <PageHeader title="Mock Test Results" description="See how you did in each section, and how you are improving." icon="score" />
      <MockTestResults history={history} />
    </>
  );
}
