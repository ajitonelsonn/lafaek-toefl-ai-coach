import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPracticeType, type PracticeSlug } from "@/lib/config/practice-types";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getPracticeSet } from "@/lib/server/practice";
import { getBatchStatus } from "@/lib/server/generation/status";
import { PracticeRunner } from "@/components/practice/PracticeRunner";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: getPracticeType(slug)?.title ?? "Practice" };
}

export default async function PracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = getPracticeType(slug);
  if (!type) notFound();
  const { user } = await requireAuthPage();
  const [set, batch] = await Promise.all([getPracticeSet(user.id, slug as PracticeSlug), getBatchStatus(user.id)]);
  const task = batch?.tasks.find((t) => t.slug === slug) ?? null;
  return <PracticeRunner type={type} set={set} task={task} />;
}
