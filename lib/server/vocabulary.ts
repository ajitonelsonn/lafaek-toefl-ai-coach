import "server-only";
import type { VocabCategory, VocabWord } from "@/lib/services/types";
import { db } from "./db";

export type VocabProgressMap = Record<string, { status?: "known" | "review"; bookmarked: boolean }>;

/** The learner's generated vocabulary, newest first. */
export async function listVocabulary(userId: string): Promise<VocabWord[]> {
  const rows = await db.vocabularyWord.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    word: r.word,
    partOfSpeech: r.partOfSpeech,
    pronunciation: r.pronunciation,
    meaning: r.meaning,
    example: r.example,
    category: r.category as VocabCategory,
    related: (r.relatedJson as VocabWord["related"]) ?? undefined,
    taskSlug: r.taskSlug,
  }));
}

export async function vocabularyProgress(userId: string): Promise<VocabProgressMap> {
  const rows = await db.vocabularyProgress.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [r.wordId, { status: (r.status ?? undefined) as "known" | "review" | undefined, bookmarked: r.bookmarked }]));
}

/** Whether vocabulary is still being prepared for this learner (queued or running jobs). */
export async function vocabularyPending(userId: string): Promise<boolean> {
  const n = await db.generationJob.count({ where: { userId, jobType: { in: ["task_pack", "vocabulary_pack"] }, status: { in: ["queued", "retry_wait", "running", "validating", "storing"] } } });
  return n > 0;
}

export async function ownsWord(userId: string, wordId: string): Promise<boolean> {
  return (await db.vocabularyWord.count({ where: { id: wordId, userId } })) > 0;
}
