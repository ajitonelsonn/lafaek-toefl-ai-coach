import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { VocabularyPage } from "@/components/vocabulary/VocabularyPage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";

export const metadata: Metadata = { title: "Vocabulary" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const rows = await db.vocabularyProgress.findMany({ where: { userId: user.id } });
  const progress = Object.fromEntries(rows.map((r) => [r.wordId, { status: (r.status ?? undefined) as "known" | "review" | undefined, bookmarked: r.bookmarked }]));
  return (
    <>
      <PageHeader title="Vocabulary" description="Learn and practise important TOEFL vocabulary." icon="practice" art={ILLUSTRATIONS.headerVocabulary} />
      <VocabularyPage initialProgress={progress} />
    </>
  );
}
