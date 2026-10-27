import type { Metadata } from "next";
import { MockTestSession } from "@/components/mock-test/MockTestSession";

export const metadata: Metadata = { title: "Mock Test Session" };

export default async function Page({ searchParams }: { searchParams: Promise<{ sections?: string }> }) {
  const { sections } = await searchParams;
  return <MockTestSession sectionsParam={sections} />;
}
