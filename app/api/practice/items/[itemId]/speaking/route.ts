import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { features } from "@/lib/server/env";
import { ApiError, json, route, uuidParam, validate } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";
import { rateLimit } from "@/lib/server/rate-limit";
import { getOwnedItem } from "@/lib/server/practice";
import { unitIdsOf } from "@/lib/server/content/view";
import { REPEAT_PASS, inspectWav, isAcceptedForAsr, repeatCorrect, wordSimilarity } from "@/lib/server/content/speech";
import { transcribeAudio } from "@/lib/server/providers/meta";
import { ProviderError } from "@/lib/server/providers/http";
import { recordUsage } from "@/lib/server/usage";
import { bucketName, objectKeyFor, putObject } from "@/lib/server/storage/s3";
import type { PracticeSlug } from "@/lib/config/practice-types";
import type { UnitResultDTO } from "@/lib/practice/dto";

const MAX_BYTES = 4 * 1024 * 1024;
export const maxDuration = 60;

// Transcribes a learner's spoken answer. The recording is kept in S3 only when the
// learner opted in and storage is configured; otherwise it is discarded after transcription.
export const POST = route<{ itemId: string }>(async (req, { params }) => {
  const { user } = await requireAuth();
  const item = await getOwnedItem(user.id, validate(uuidParam, params.itemId));
  const slug = item.taskSlug as PracticeSlug;
  if (slug !== "listen-repeat" && slug !== "take-interview") throw new ApiError(400, "VALIDATION_ERROR", "This task does not take spoken answers.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 4096) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The recording is too large.");
  await rateLimit("speaking", user.id, 60, 3600);

  const form = await req.formData().catch(() => null);
  const unitId = String(form?.get("unitId") ?? "");
  const file = form?.get("audio");
  const keep = form?.get("keepRecording") === "true";
  if (!unitIdsOf(slug, item).includes(unitId) || !(file instanceof Blob)) throw new ApiError(400, "VALIDATION_ERROR", "Please record your answer again.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The recording is too large.");
  const wav = Buffer.from(await file.arrayBuffer());
  const info = inspectWav(wav);
  if (!info || !isAcceptedForAsr(info) || info.durationSeconds > 120) throw new ApiError(400, "VALIDATION_ERROR", "The recording format is not supported.");

  let transcript: string;
  let durationMs: number | null;
  try {
    const r = await transcribeAudio(wav);
    transcript = r.transcript.trim();
    durationMs = r.audioDurationMs;
    await recordUsage({
      idempotencyKey: `meta:asr:${randomUUID()}`,
      userId: user.id,
      eventType: "transcription",
      provider: "meta",
      modelId: r.model,
      audioSeconds: Math.floor((r.audioDurationMs ?? info.durationSeconds * 1000) / 1000),
    });
  } catch (e) {
    if (e instanceof ProviderError) throw new ApiError(502, "PROVIDER_ERROR", "Speech recognition is not available right now. Your recording was not saved.");
    throw e;
  }

  const result: UnitResultDTO = { correct: null, transcript, label: "Transcript-based practice estimate — not an official or pronunciation score." };
  if (slug === "listen-repeat") {
    const expected = String((item.answerKeyJson as Record<string, string>)[unitId] ?? "");
    const sim = wordSimilarity(expected, transcript);
    result.similarity = sim.score;
    result.answer = expected;
    // Scored like the other auto-scored tasks: correct when most of the words match.
    result.correct = repeatCorrect(sim.score);
    result.label = `Correct when at least ${REPEAT_PASS * 100}% of the words match. ${result.label}`;
  } else {
    const words = transcript ? transcript.split(/\s+/).length : 0;
    const seconds = (durationMs ?? info.durationSeconds * 1000) / 1000;
    result.explanation = `${words} words in about ${Math.round(seconds)} seconds${seconds > 5 ? ` (${Math.round((words / seconds) * 60)} words per minute)` : ""}.`;
  }

  const attempt = await db.practiceAttempt.create({
    data: {
      userId: user.id,
      practiceItemId: item.id,
      taskSlug: slug,
      unitId,
      responseJson: { transcript, durationSeconds: Math.round(info.durationSeconds) },
      scoreJson: { correct: result.correct, similarity: result.similarity ?? null } as Prisma.InputJsonValue,
      feedbackJson: { label: result.label },
      scoringVersion: "speech-1",
    },
  });

  if (keep && features.storage()) {
    const prefs = await db.userPreferences.findUnique({ where: { userId: user.id }, select: { recordingConsent: true } });
    if (prefs?.recordingConsent) {
      const assetId = randomUUID();
      const objectKey = objectKeyFor({ ownerId: user.id, attemptId: attempt.id, kind: "recording", assetId, mimeType: "audio/wav" });
      await db.mediaAsset.create({ data: { id: assetId, userId: user.id, practiceItemId: item.id, attemptId: attempt.id, kind: "recording", role: `recording:${unitId}`, bucket: bucketName(), objectKey, mimeType: "audio/wav", status: "pending" } });
      const up = await putObject(objectKey, wav, "audio/wav");
      await db.mediaAsset.update({ where: { id: assetId }, data: { status: "ready", byteSize: up.byteSize, checksum: up.checksum, durationMs: Math.round(info.durationSeconds * 1000) } });
    }
  }

  return json({ results: { [unitId]: result }, attemptId: attempt.id });
});
