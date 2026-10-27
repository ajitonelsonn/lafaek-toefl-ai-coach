import "server-only";
import { Prisma } from "@prisma/client";
import type { StudyPlan } from "@/lib/services/types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";
import type { StudyPlanDTO } from "@/lib/practice/plan-dto";
import { db } from "./db";
import { env } from "./env";
import { ApiError } from "./http";
import { buildStudyPlan } from "./study-plan-builder";

const CEFR: Record<StudyPlanInputBody["level"], string> = { beginner: "A2", intermediate: "B1", "upper-intermediate": "B2", advanced: "C1" };
export const cefrForLevel = (level: StudyPlanInputBody["level"]) => CEFR[level];

export type { StudyPlanDTO };

/** Each plan starts a new AI generation, so an account may make one plan per cooldown period (default 30 days). */
function nextPlanAt(lastCreatedAt: Date): Date | null {
  const next = new Date(lastCreatedAt.getTime() + env().STUDY_PLAN_COOLDOWN_DAYS * 86_400_000);
  return next > new Date() ? next : null;
}

function toDTO(row: { id: string; version: number; answersJson: Prisma.JsonValue; createdAt: Date }): StudyPlanDTO {
  const a = row.answersJson as unknown as { input: StudyPlanInputBody; plan: StudyPlan };
  return { ...a.plan, input: a.input, id: row.id, createdAt: row.createdAt.toISOString(), version: row.version, nextPlanAt: nextPlanAt(row.createdAt)?.toISOString() ?? null };
}

export async function getActivePlan(userId: string): Promise<StudyPlanDTO | null> {
  const row = await db.studyPlan.findFirst({ where: { userId, status: "active" } });
  return row ? toDTO(row) : null;
}

/**
 * Saves the plan. The first plan is version 1. Replacing it needs an explicit confirmation,
 * creates a new version (which gets its own generation batch), and is allowed only once the
 * cooldown since the current plan has passed.
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
    const next = current ? nextPlanAt(current.createdAt) : null;
    if (next) {
      const days = env().STUDY_PLAN_COOLDOWN_DAYS;
      throw new ApiError(403, "PLAN_LIMIT", `You can make one study plan every ${days} days. You can make a new plan from ${next.toISOString().slice(0, 10)}.`, { nextPlanAt: next.toISOString() });
    }
    if (current) await tx.studyPlan.update({ where: { id: current.id }, data: { status: "superseded" } });
    return tx.studyPlan.create({ data: { userId, version: (current?.version ?? 0) + 1, status: "active", ...data } });
  });
  return toDTO(row);
}
