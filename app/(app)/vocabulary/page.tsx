import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { VocabularyPage } from "@/components/vocabulary/VocabularyPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getActivePlan } from "@/lib/server/study-plan";
import { listVocabulary, vocabularyPending, vocabularyProgress } from "@/lib/server/vocabulary";

export const metadata: Metadata = { title: "Vocabulary" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const [words, progress, pending, plan] = await Promise.all([listVocabulary(user.id), vocabularyProgress(user.id), vocabularyPending(user.id), getActivePlan(user.id)]);
  return (
    <>
      <PageHeader title="Vocabulary" description="Learn the important words from your own practice questions." icon="practice" art={ILLUSTRATIONS.headerVocabulary} />
      <VocabularyPage words={words} initialProgress={progress} pending={pending} hasPlan={Boolean(plan)} />
    </>
  );
}
