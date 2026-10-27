// Client-safe study plan DTO.
import type { ScheduleDay, StudyPlan } from "@/lib/services/types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";

export type StudyPlanDTO = Omit<StudyPlan, "input"> & {
  input: StudyPlanInputBody;
  version: number;
  /** The AI pass over the schedule is still queued or running. */
  schedulePending: boolean;
};

export interface PlanToday {
  /** The scheduled day shown as "today": today itself, or the next study day. */
  day: ScheduleDay | null;
  isToday: boolean;
  tasks: { id: string; label: string; href: string; minutes: number }[];
}

/**
 * What the learner should do today (by their local calendar date). Plans without a dated
 * schedule fall back to their daily task template.
 */
export function planToday(plan: Pick<StudyPlanDTO, "schedule" | "dailyTasks">, today: string): PlanToday {
  if (!plan.schedule?.length) return { day: null, isToday: true, tasks: plan.dailyTasks };
  const day = plan.schedule.find((d) => d.date === today) ?? plan.schedule.find((d) => d.date > today) ?? null;
  const tasks = (day?.tasks ?? []).map((t, i) => ({ id: `${day!.date}-${i}`, label: t.label, href: t.href, minutes: t.minutes }));
  return { day, isToday: day?.date === today, tasks };
}

/** "Fri 13 Nov" from YYYY-MM-DD, the same on server and browser. */
export const shortDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
