import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MockTestSession } from "@/components/mock-test/MockTestSession";
import { requireAuthPage } from "@/lib/server/auth/session";
import { activeMockTest } from "@/lib/server/mock-test";

export const metadata: Metadata = { title: "Mock Test Session" };

// Shows the learner's started test (POST /api/mock-test/start). Reloading resumes the same
// questions without using another credit; with no started test, go back to the start page.
export default async function Page() {
  const { user } = await requireAuthPage();
  const test = await activeMockTest(user.id);
  if (!test) redirect("/mock-test");
  const sections = [...new Set(test.items.map((i) => i.skill))];
  return <MockTestSession form={test.items} token={test.token} sections={sections} />;
}
