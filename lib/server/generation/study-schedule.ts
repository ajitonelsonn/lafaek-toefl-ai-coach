import "server-only";
import { Prisma, type GenerationJob } from "@prisma/client";
import { z } from "zod";
import { PRACTICE_TYPES, type PracticeSlug, type SkillId } from "@/lib/config/practice-types";
import { formatBand } from "@/lib/config/toefl-scale";
import type { ScheduleWeek, StudyPlan } from "@/lib/services/types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";
import { db } from "../db";
import { recordUsage } from "../usage";
import { generateText } from "../providers/meta";
import { ALL_SKILLS, assemblePlan, finalReviewDate, planCalendar, ruleWeeks, weekOf, weekdayOf, type PlanCalendar } from "../study-plan-builder";
import { enqueueJob } from "./queue";

// AI pass over a saved plan: Meta proposes a week-by-week outline (themes, focus skills, priority
// tasks, mock-test days, tips) for the learner's real calendar. The outline is validated against
// that calendar and expanded into dated days by the same code as the rule-based plan, so every
// day still fits the learner's study days and daily minutes. Invalid parts fall back to the rules.

const SLUGS = PRACTICE_TYPES.map((t) => t.slug) as [PracticeSlug, ...PracticeSlug[]];

const outlineSchema = z.strictObject({
  weeks: z
    .array(
      z.strictObject({
        week: z.number().int().min(1),
        theme: z.string().min(3).max(80),
        focusSkills: z.array(z.enum(ALL_SKILLS as [SkillId, ...SkillId[]])).min(1).max(4),
        priorityTasks: z.array(z.enum(SLUGS)).min(2).max(6),
        mockTestDate: z.string().nullable(),
        tip: z.string().min(10).max(220),
      }),
    )
    .min(1)
    .max(60),
});

export async function queueStudySchedule(userId: string, studyPlanId: string) {
  await enqueueJob({ idempotencyKey: `${studyPlanId}:study_schedule`, jobType: "study_schedule", userId, payload: { studyPlanId } });
}

/** Keeps the AI outline only where it fits the calendar; anything invalid uses the rule week. */
export function mergeOutline(cal: PlanCalendar, rules: ScheduleWeek[], ai: z.infer<typeof outlineSchema>["weeks"]): ScheduleWeek[] {
  const finalDay = finalReviewDate(cal);
  return rules.map((rule) => {
    const proposal = ai.find((w) => w.week === rule.week);
    if (!proposal) return rule;
    const allowedMock = cal.studyDates.filter((d) => weekOf(cal, d) === rule.week && d !== finalDay);
    const mock = proposal.mockTestDate && allowedMock.includes(proposal.mockTestDate) ? proposal.mockTestDate : null;
    return {
      ...rule,
      theme: proposal.theme.trim(),
      focusSkills: [...new Set(proposal.focusSkills)],
      priorityTasks: [...new Set(proposal.priorityTasks)],
      // Keep at least the rule's mock test before the test date if the AI drops it.
      mockTestDate: mock ?? rule.mockTestDate,
      tip: proposal.tip.trim(),
    };
  });
}

function prompt(input: StudyPlanInputBody, cal: PlanCalendar, rules: ScheduleWeek[]): string {
  const tasks = PRACTICE_TYPES.map((t) => `- ${t.slug} (${t.skill}, about ${t.minutesPerItem} min per question): ${t.title}`).join("\n");
  const weeks = rules
    .map((w) => {
      const days = cal.studyDates.filter((d) => d >= w.start && d <= w.end);
      return `Week ${w.week}: ${w.start} to ${w.end}; study days: ${days.length ? days.map((d) => `${d} (${weekdayOf(d)})`).join(", ") : "none"}`;
    })
    .join("\n");
  return [
    "Create a week-by-week TOEFL iBT study outline for this learner.",
    `Level: ${input.level}. Target score: ${formatBand(input.targetScore)} of 6 (TOEFL 2026 scale). Weakest skills: ${input.weakAreas.join(", ") || "not sure"}. Focus: ${input.emphasis}. Goal: ${input.goals || "not given"}.`,
    `Study time: ${input.dailyMinutes} minutes per study day.`,
    cal.testDate ? `Plan starts ${cal.startDate}. The test is on ${cal.testDate} (${cal.daysUntilTest} days away).` : `Plan starts ${cal.startDate} and runs ${cal.weekCount} weeks (no test date yet).`,
    "Calendar:",
    weeks,
    "Practice task types (use these exact ids in priorityTasks):",
    tasks,
    "Rules: return exactly one entry per week above, in order. Build from easier to harder and finish with test practice and review. Give more time to the weakest skills.",
    "Schedule mock tests only on listed study dates (about one every 2–3 weeks in long plans, and one 3–6 days before the test). Never on the last study day before the test. Use null when a week has no mock test.",
    "Themes are short (a few words). Tips are one practical sentence in simple English.",
  ].join("\n");
}

/** Asks Meta for a week-by-week outline of the learner's calendar (validated by the schema). */
export function proposeOutline(input: StudyPlanInputBody, cal: PlanCalendar, rules: ScheduleWeek[]) {
  return generateText({
    task: "generate:study-schedule",
    schema: outlineSchema,
    system: "You are an experienced TOEFL iBT teacher who writes realistic, encouraging study plans. Return JSON only.",
    user: prompt(input, cal, rules),
    temperature: 0.4,
  });
}

export async function runStudySchedule(job: GenerationJob): Promise<void> {
  const { studyPlanId } = job.payloadJson as { studyPlanId: string };
  const row = await db.studyPlan.findUnique({ where: { id: studyPlanId } });
  if (!row || row.status !== "active") return; // replaced or deleted: nothing to personalise
  const stored = row.answersJson as unknown as { input: StudyPlanInputBody; plan: StudyPlan };
  if (!stored.plan.startDate) return; // plans saved before dated schedules
  const cal = planCalendar(stored.input, stored.plan.startDate);
  const rules = ruleWeeks(stored.input, cal);

  const r = await proposeOutline(stored.input, cal, rules);
  await recordUsage({
    idempotencyKey: `meta:${r.requestId ?? `${job.id}:${job.attemptCount}:schedule`}`,
    userId: job.userId,
    eventType: "plan_generation",
    provider: "meta",
    modelId: r.model,
    inputUnits: r.usage.inputTokens,
    outputUnits: r.usage.outputTokens,
    generationJobId: job.id,
    metadata: { weeks: cal.weekCount },
  });

  const weeks = mergeOutline(cal, rules, r.data.weeks);
  const plan = { ...assemblePlan(stored.input, cal, weeks, "ai"), id: stored.plan.id, createdAt: stored.plan.createdAt };
  // Only update the plan that is still active (a new version may have been saved meanwhile).
  await db.studyPlan.updateMany({ where: { id: row.id, status: "active" }, data: { answersJson: { input: stored.input, plan } as unknown as Prisma.InputJsonValue } });
}
