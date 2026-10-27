import "server-only";
import type { GenerationJob } from "@prisma/client";
import { z } from "zod";
import { getPracticeType, type PracticeSlug } from "@/lib/config/practice-types";
import { VOCAB_CATEGORIES } from "@/lib/content/vocabulary";
import { db } from "../db";
import { env } from "../env";
import { recordUsage } from "../usage";
import { generateText } from "../providers/meta";
import { JobFailure } from "./handlers";
import { enqueueJob } from "./queue";

// Vocabulary is generated from the learner's own questions: after a task pack completes,
// one vocabulary_pack job asks Meta for useful words that appear in that pack's texts.

const CATEGORY_IDS = VOCAB_CATEGORIES.map((c) => c.id) as [string, ...string[]];
const POS = ["noun", "verb", "adjective", "adverb", "phrasal verb", "phrase"] as const;

const vocabSchema = z.strictObject({
  words: z
    .array(
      z.strictObject({
        word: z.string().min(2).max(40),
        partOfSpeech: z.enum(POS),
        pronunciation: z.string().min(2).max(60),
        meaning: z.string().min(5).max(200),
        example: z.string().min(10).max(240),
        category: z.enum(CATEGORY_IDS),
        related: z.array(z.strictObject({ word: z.string().min(2).max(40), partOfSpeech: z.enum(POS), meaning: z.string().min(3).max(160) })).max(3),
      }),
    )
    .min(1)
    .max(25),
});

const SKIP_KEYS = new Set(["imagePrompt", "id", "voice", "voiceId", "role", "speakerId", "locale"]);

/** All learner-visible text of a set of items (passages, scripts, prompts, options), capped. */
export function corpusOf(contents: unknown[], maxChars = 9000): string {
  const out: string[] = [];
  const walk = (v: unknown, key?: string) => {
    if (key && SKIP_KEYS.has(key)) return;
    if (typeof v === "string") {
      if (v.trim().length >= 3) out.push(v.trim());
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  contents.forEach((c) => walk(c));
  return out.join("\n").slice(0, maxChars);
}

export const normaliseWord = (w: string) => w.trim().toLowerCase().replace(/\s+/g, " ");

/** True when the word (or its stem, e.g. "analyze" for "analyzed") occurs in the text. */
export function appearsIn(word: string, corpusLower: string): boolean {
  const w = normaliseWord(word);
  if (corpusLower.includes(w)) return true;
  return w.length >= 5 && !w.includes(" ") && corpusLower.includes(w.slice(0, w.length - 2));
}

/** Queues vocabulary extraction for a completed task pack (idempotent per batch and task). */
export async function queueVocabularyFor(job: Pick<GenerationJob, "batchId" | "userId" | "taskSlug" | "payloadJson">) {
  if (!job.userId || !job.taskSlug || !job.batchId) return;
  const { studyPlanId } = job.payloadJson as { studyPlanId: string };
  await enqueueJob({
    idempotencyKey: `${job.batchId}:vocabulary_pack:${job.taskSlug}`,
    jobType: "vocabulary_pack",
    userId: job.userId,
    batchId: job.batchId,
    taskSlug: job.taskSlug,
    payload: { studyPlanId, words: env().VOCABULARY_WORDS_PER_TASK },
  });
}

/** Queues vocabulary for task packs that finished before this feature existed. */
export async function backfillVocabularyJobs(): Promise<number> {
  const packs = await db.generationJob.findMany({ where: { jobType: "task_pack", status: "completed" }, select: { batchId: true, userId: true, taskSlug: true, payloadJson: true } });
  const have = new Set(
    (await db.generationJob.findMany({ where: { jobType: "vocabulary_pack" }, select: { idempotencyKey: true } })).map((j) => j.idempotencyKey),
  );
  const missing = packs.filter((p) => p.batchId && !have.has(`${p.batchId}:vocabulary_pack:${p.taskSlug}`));
  for (const p of missing) await queueVocabularyFor(p);
  return missing.length;
}

export async function runVocabularyPack(job: GenerationJob): Promise<void> {
  const slug = job.taskSlug as PracticeSlug;
  const { studyPlanId, words } = job.payloadJson as { studyPlanId: string; words: number };
  if (!job.userId) throw new JobFailure("PLAN_MISSING", "Vocabulary job has no user.", false);
  const items = await db.practiceItem.findMany({ where: { userId: job.userId, studyPlanId, taskSlug: slug, validationStatus: "valid" }, select: { contentJson: true } });
  if (!items.length) return; // nothing to learn from (e.g. the pack produced no items)
  const corpus = corpusOf(items.map((i) => i.contentJson));
  const known = (await db.vocabularyWord.findMany({ where: { userId: job.userId }, select: { word: true }, orderBy: { createdAt: "desc" }, take: 200 })).map((w) => w.word);

  const r = await generateText({
    task: `generate:vocabulary-${slug}`,
    schema: vocabSchema,
    system:
      "You are an English vocabulary teacher for adult TOEFL learners (CEFR B1–C1). Choose useful academic or campus words that appear in the given texts. Explain them in simple English. Return JSON only.",
    user: [
      `Texts from the learner's "${getPracticeType(slug)?.title ?? slug}" practice questions:`,
      "<<<",
      corpus,
      ">>>",
      `Choose up to ${words} different words or short phrases that appear in the texts above and are worth learning for the TOEFL. Prefer academic and topic words; skip very basic words (e.g. "good", "people") and names.`,
      known.length ? `Do not choose any of these words, the learner already has them: ${known.join(", ")}.` : "",
      "For each: the word as it appears (base form if possible), part of speech, IPA pronunciation, a short simple meaning, an example sentence (from the text or close to it), a category, and 0–3 related word forms.",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.4,
  });
  await recordUsage({
    idempotencyKey: `meta:${r.requestId ?? `${job.id}:${job.attemptCount}:vocab`}`,
    userId: job.userId,
    eventType: "vocabulary_generation",
    provider: "meta",
    modelId: r.model,
    inputUnits: r.usage.inputTokens,
    outputUnits: r.usage.outputTokens,
    generationJobId: job.id,
    metadata: { taskSlug: slug },
  });

  // Keep only words that really occur in the learner's questions; drop duplicates.
  const lower = corpus.toLowerCase();
  const seen = new Set(known.map(normaliseWord));
  const rows = r.data.words
    .filter((w) => appearsIn(w.word, lower))
    .filter((w) => !seen.has(normaliseWord(w.word)) && seen.add(normaliseWord(w.word)))
    .slice(0, words)
    .map((w) => ({
      userId: job.userId!,
      studyPlanId,
      generationJobId: job.id,
      taskSlug: slug,
      word: w.word.trim(),
      wordNormalized: normaliseWord(w.word),
      partOfSpeech: w.partOfSpeech,
      pronunciation: w.pronunciation.trim(),
      meaning: w.meaning.trim(),
      example: w.example.trim(),
      category: w.category,
      relatedJson: w.related.length ? w.related : undefined,
    }));
  if (rows.length) await db.vocabularyWord.createMany({ data: rows, skipDuplicates: true });
}
