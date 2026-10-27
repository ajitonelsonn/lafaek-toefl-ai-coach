import type { Metadata } from "next";
import { MockTestSession } from "@/components/mock-test/MockTestSession";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getMockForm } from "@/lib/server/mock-test";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";

export const metadata: Metadata = { title: "Mock Test Session" };

export default async function Page({ searchParams }: { searchParams: Promise<{ sections?: string }> }) {
  await requireAuthPage();
  const { sections: raw } = await searchParams;
  const picked = (raw ?? "").split(",").filter((s): s is SkillId => SKILLS.some((k) => k.id === s));
  const sections = picked.length ? picked : SKILLS.map((s) => s.id);
  const form = await getMockForm(sections);
  return <MockTestSession form={form} sections={sections} />;
}
