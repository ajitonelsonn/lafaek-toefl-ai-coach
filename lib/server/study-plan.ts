import "server-only";
import { Prisma } from "@prisma/client";
import type { StudyPlan } from "@/lib/services/types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";
import type { StudyPlanDTO } from "@/lib/practice/plan-dto";
import { normaliseTarget } from "@/lib/config/toefl-scale";
import { db } from "./db";
import { features } from "./env";
import { usePlanCredit } from "./credits";
import { queueStudySchedule } from "./generation/study-schedule";
import { ApiError } from "./http";
import { buildStudyPlan } from "./study-plan-builder";

const CEFR: Record<StudyPlanInputBody["level"], string> = { beginner: "A2", intermediate: "B1", "upper-intermediate": "B2", advanced: "C1" };
export const cefrForLevel = (level: StudyPlanInputBody["level"]) => CEFR[level];

export type { StudyPlanDTO };

function toDTO(row: { id: string; version: number; answersJson: Prisma.JsonValue; createdAt: Date }, schedulePending = false): StudyPlanDTO {
  const a = row.answersJson as unknown as { input: StudyPlanInputBody; plan: StudyPlan };
  // Plans saved before the 2026 scale stored a 0–120 target; read them as the nearest 1–6 band.
  const input = { ...a.input, targetScore: normaliseTarget(a.input.targetScore) };
  return { ...a.plan, input, id: row.id, createdAt: row.createdAt.toISOString(), version: row.version, schedulePending };
}

export async function getActivePlan(userId: string): Promise<StudyPlanDTO | null> {
  const row = await db.studyPlan.findFirst({ where: { userId, status: "active" } });
  if (!row) return null;
  return toDTO(row, await schedulePending(row.id));
}

/** The AI schedule job for this plan is still waiting or running. */
async function schedulePending(studyPlanId: string): Promise<boolean> {
  const n = await db.generationJob.count({ where: { idempotencyKey: `${studyPlanId}:study_schedule`, status: { in: ["queued", "retry_wait", "running", "validating", "storing"] } } });
  return n > 0;
}

/**
 * Saves the plan. Every save (the first plan, an edit or a new plan) creates a version with its own
 * generation batch and uses one lifetime study-plan credit: Starter gives 1, each Boost Pack 1 more.
 * Replacing an existing plan also needs an explicit confirmation.
 */
export async function savePlan(userId: string, input: StudyPlanInputBody, confirmNewVersion: boolean): Promise<StudyPlanDTO> {
  const plan = buildStudyPlan({ ...input, testDate: input.testDate });
  const data = {
    currentLevel: input.level,
    targetLevel: cefrForLevel(input.level),
    targetScoreBand: String(input.targetScore),
    testDate: input.testDate ? new Date(`${input.testDate}T00:00:00Z`) : null,
    studyDays: input.studyDays,
    dailyMinutes: input.dailyMinutes,
    focusAreas: { weakAreas: input.weakAreas, emphasis: input.emphasis },
    accentPreferences: input.accents,
    answersJson: { input, plan } as unknown as Prisma.InputJsonValue,
    completedAt: new Date(),
  };
  const row = await db.$transaction(async (tx) => {
    // Per-user lock so two concurrent saves cannot both pass the limit check.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(724812, hashtext(${userId}))`;
    const current = await tx.studyPlan.findFirst({ where: { userId, status: "active" } });
    if (current && !confirmNewVersion) throw new ApiError(409, "CONFLICT", "You already have a study plan. Confirm to save a new version.");
    await usePlanCredit(tx, userId);
    if (current) await tx.studyPlan.update({ where: { id: current.id }, data: { status: "superseded" } });
    return tx.studyPlan.create({ data: { userId, version: (current?.version ?? 0) + 1, status: "active", ...data } });
  }, { maxWait: 10_000, timeout: 20_000 });
  // The worker personalises the dated schedule with AI; until then the rule-based schedule is shown.
  if (features.metaText()) await queueStudySchedule(userId, row.id).catch(() => undefined);
  return toDTO(row, features.metaText());
}
