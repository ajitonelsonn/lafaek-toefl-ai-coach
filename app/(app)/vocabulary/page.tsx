import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { VocabularyPage } from "@/components/vocabulary/VocabularyPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Vocabulary" };

export default function Page() {
  return (
    <>
      <PageHeader title="Vocabulary" description="Learn and practise important TOEFL vocabulary." icon="practice" art={ILLUSTRATIONS.headerVocabulary} />
      <VocabularyPage />
    </>
  );
}
