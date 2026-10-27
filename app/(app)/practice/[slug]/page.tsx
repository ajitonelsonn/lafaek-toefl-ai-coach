import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRACTICE_SLUGS, getPracticeType, type PracticeSlug } from "@/lib/config/practice-types";
import { services } from "@/lib/services";
import { sampleUnitIds } from "@/lib/mock-data/questions";
import { PracticeRunner } from "@/components/practice/PracticeRunner";
import { ErrorState } from "@/components/ui/States";
import { LinkButton } from "@/components/ui/Button";

export function generateStaticParams() {
  return PRACTICE_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: getPracticeType(slug)?.title ?? "Practice" };
}

export default async function PracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const type = getPracticeType(slug);
  if (!type) notFound();

  const set = await services.questions.getQuestionSet(slug as PracticeSlug);
  if (!set) {
    return (
      <ErrorState
        title="This practice set is not available"
        description="We couldn't load questions for this task type. Please try another practice type."
        action={<LinkButton href="/practice">Back to Practice Center</LinkButton>}
      />
    );
  }

  return <PracticeRunner type={type} content={set.content} sampleCount={sampleUnitIds(set.content).length} />;
}
