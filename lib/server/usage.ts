import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

// Append-only usage accounting. Writes are idempotent by `idempotencyKey`
// (provider request / job / asset id), so retries never double count.

export interface UsageInput {
  idempotencyKey: string;
  userId: string | null;
  eventType: "text_generation" | "text_feedback" | "image_generation" | "speech_synthesis" | "transcription" | "content_validation" | "vocabulary_generation" | "plan_generation";
  provider: "meta" | "elevenlabs";
  modelId: string;
  inputUnits?: number | null;
  outputUnits?: number | null;
  audioSeconds?: number | null;
  imageCount?: number | null;
  characterCount?: number | null;
  isEstimate?: boolean;
  generationJobId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function recordUsage(u: UsageInput): Promise<void> {
  await db.usageEvent
    .create({
      data: {
        idempotencyKey: u.idempotencyKey,
        userId: u.userId,
        eventType: u.eventType,
        provider: u.provider,
        modelId: u.modelId,
        inputUnits: u.inputUnits ?? null,
        outputUnits: u.outputUnits ?? null,
        audioSeconds: u.audioSeconds ?? null,
        imageCount: u.imageCount ?? null,
        characterCount: u.characterCount ?? null,
        isEstimate: u.isEstimate ?? false,
        generationJobId: u.generationJobId ?? null,
        metadataJson: (u.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
    .catch((e: unknown) => {
      // Unique violation = this event was already recorded (retry). Anything else is real.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
      throw e;
    });
}
