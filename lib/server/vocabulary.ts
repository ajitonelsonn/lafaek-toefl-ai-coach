import "server-only";
import { randomUUID } from "node:crypto";
import type { VocabCategory, VocabWord } from "@/lib/services/types";
import { db } from "./db";
import { features } from "./env";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";
import { recordUsage } from "./usage";
import { pickVoices, synthesizeSpeech } from "./providers/elevenlabs";
import { bucketName, objectKeyFor, putObject, signedGetUrl } from "./storage/s3";

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

const URL_TTL = 300;

/**
 * Natural-voice pronunciation for one of the learner's words: made once with ElevenLabs in the
 * learner's preferred accent, stored privately in S3, then served through short-lived signed URLs.
 */
export async function wordAudioUrl(userId: string, wordId: string): Promise<{ url: string; expiresIn: number }> {
  const word = await db.vocabularyWord.findFirst({ where: { id: wordId, userId } });
  if (!word) throw new ApiError(404, "NOT_FOUND", "Unknown word.");
  const role = `vocabulary:${word.id}`;
  const existing = await db.mediaAsset.findFirst({ where: { userId, role, kind: "audio", status: "ready", deletedAt: null } });
  if (existing) return { url: await signedGetUrl(existing.objectKey, existing.mimeType, URL_TTL), expiresIn: URL_TTL };

  if (!features.tts() || !features.storage()) throw new ApiError(503, "CONFIGURATION_MISSING", "Natural voice is not available right now.");
  await rateLimit("vocab-audio", userId, 120, 3600);

  const plan = await db.studyPlan.findFirst({ where: { userId, status: "active" }, select: { accentPreferences: true } });
  const accents = Array.isArray(plan?.accentPreferences) ? (plan.accentPreferences as string[]) : [];
  const [voice] = await pickVoices(1, accents.slice(0, 1), 0); // one steady voice for every word
  const audio = await synthesizeSpeech(word.word, voice.voiceId);

  const assetId = randomUUID();
  const objectKey = objectKeyFor({ ownerId: userId, taskSlug: "vocabulary", itemId: word.id, kind: "audio", assetId, mimeType: audio.mimeType });
  await db.mediaAsset.create({
    data: {
      id: assetId,
      userId,
      kind: "audio",
      role,
      bucket: bucketName(),
      objectKey,
      mimeType: audio.mimeType,
      provider: "elevenlabs",
      modelId: audio.model,
      voiceProfileJson: { locale: voice.locale, voiceId: voice.voiceId, provider: "elevenlabs", modelId: audio.model },
      status: "pending",
    },
  });
  const stored = await putObject(objectKey, audio.bytes, audio.mimeType);
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "ready", byteSize: stored.byteSize, checksum: stored.checksum, durationMs: Math.round((audio.bytes.length * 8) / 128) } });
  await recordUsage({
    idempotencyKey: `elevenlabs:vocabulary:${word.id}`,
    userId,
    eventType: "speech_synthesis",
    provider: "elevenlabs",
    modelId: audio.model,
    characterCount: audio.characters,
    audioSeconds: Math.max(1, Math.round(audio.bytes.length / 16000)),
    isEstimate: true,
  });
  return { url: await signedGetUrl(objectKey, audio.mimeType, URL_TTL), expiresIn: URL_TTL };
}
