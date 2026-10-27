import "server-only";
// Dated study-plan builder. It counts the days from the learner's start date to the test (or uses
// a length based on level when there is no test date), places every study day on the learner's
// chosen weekdays, and fills each day within the daily time budget. `ruleWeeks` gives a sensible
// week-by-week outline; the worker can replace it with an AI-personalised one and call
// `expandSchedule` again (lib/server/generation/study-schedule.ts). Practice content itself is
// generated separately.
import { PRACTICE_TYPES, SKILLS, getPracticeType, practiceHref, type PracticeSlug, type SkillId } from "@/lib/config/practice-types";
import { MOCK_DEMO_MINUTES } from "@/lib/config/mock-test";
import type { ScheduleDay, ScheduleTask, ScheduleWeek, StudyPlan, StudyPlanInput, StudyPlanPhase, Weekday } from "@/lib/services/types";
import { ApiError } from "./http";

export const MAX_PLAN_DAYS = 366;
const DAY = 86_400_000;
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SKILL_LABEL: Record<SkillId, string> = { reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking" };
const MOCK_MINUTES = Object.values(MOCK_DEMO_MINUTES).reduce((a, b) => a + b, 0);

// Phase pools: shorter tasks first, then longer texts and talks, then writing and interviews.
const PHASES: { title: string; focus: string; tasks: PracticeSlug[]; tip: string }[] = [
  { title: "Build Foundation", focus: "Short tasks to build confidence and speed.", tasks: ["complete-the-words", "read-in-daily-life", "build-sentence", "listen-choose-response"], tip: "Aim for accuracy first; speed comes with practice." },
  { title: "Improve Skills", focus: "Longer texts and talks to improve accuracy.", tasks: ["read-academic-passage", "listen-conversation", "listen-announcement", "listen-repeat"], tip: "Take short notes while you listen: who, what, why." },
  { title: "Expand Practice", focus: "Writing, interviews and the hardest listening.", tasks: ["listen-academic-talk", "write-email", "academic-discussion", "take-interview"], tip: "Plan your writing for one minute before you start." },
  { title: "Test & Review", focus: "Mock tests, weak areas and final review.", tasks: ["read-academic-passage", "listen-academic-talk", "academic-discussion", "take-interview", "build-sentence", "listen-choose-response"], tip: "Review every mistake: why was the right answer right?" },
];

// --- calendar helpers (UTC noon avoids time-zone and daylight-saving edges) -----------------
export const parseDay = (s: string) => new Date(`${s}T12:00:00Z`);
export const formatDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => formatDay(new Date(parseDay(s).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY);
export const weekdayOf = (s: string): Weekday => WEEKDAYS[parseDay(s).getUTCDay()];
const shortDate = (s: string) => parseDay(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export interface PlanCalendar {
  startDate: string;
  /** Last calendar day of the plan: the test day when set. */
  endDate: string;
  testDate: string | null;
  daysUntilTest: number | null;
  studyDates: string[];
  weekCount: number;
  /** Study days were not on the chosen weekdays before the test, so every day is used. */
  usedAllDays: boolean;
}

/** The learner's start date: their local "today" if it is within a day of the server's date. */
export function resolveStartDate(clientToday: string | undefined, now = new Date()): string {
  const server = formatDay(now);
  if (clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday) && Math.abs(daysBetween(server, clientToday)) <= 1) return clientToday;
  return server;
}

export function planCalendar(input: Pick<StudyPlanInput, "testDate" | "studyDays" | "level">, startDate: string): PlanCalendar {
  let lastStudyDay: string;
  let endDate: string;
  let daysUntilTest: number | null = null;
  const testDate = input.testDate ?? null;
  if (testDate) {
    daysUntilTest = daysBetween(startDate, testDate);
    if (daysUntilTest < 0) throw new ApiError(400, "VALIDATION_ERROR", "The test date is in the past. Choose today or a later date.");
    if (daysUntilTest > MAX_PLAN_DAYS) throw new ApiError(400, "VALIDATION_ERROR", "Choose a test date within one year.");
    lastStudyDay = addDays(testDate, -1);
    endDate = testDate;
  } else {
    const weeks = { beginner: 12, intermediate: 10, "upper-intermediate": 8, advanced: 6 }[input.level];
    lastStudyDay = addDays(startDate, weeks * 7 - 1);
    endDate = lastStudyDay;
  }
  const span = daysBetween(startDate, lastStudyDay) + 1;
  const all = Array.from({ length: Math.max(0, span) }, (_, i) => addDays(startDate, i));
  let studyDates = all.filter((d) => input.studyDays.includes(weekdayOf(d)));
  // A test soon after a gap in the chosen days would leave nothing to study: use every day then.
  const usedAllDays = studyDates.length === 0 && all.length > 0;
  if (usedAllDays) studyDates = all;
  const weekCount = Math.max(1, Math.floor(daysBetween(startDate, endDate) / 7) + 1);
  return { startDate, endDate, testDate, daysUntilTest, studyDates, weekCount, usedAllDays };
}

export const weekOf = (cal: PlanCalendar, date: string) => Math.floor(daysBetween(cal.startDate, date) / 7) + 1;
const weekRange = (cal: PlanCalendar, week: number) => ({ start: addDays(cal.startDate, (week - 1) * 7), end: [addDays(cal.startDate, week * 7 - 1), cal.endDate].sort()[0] });
const phaseIndex = (week: number, weekCount: number) => {
  const f = (week - 0.5) / weekCount;
  return f < 0.3 ? 0 : f < 0.6 ? 1 : f < 0.85 ? 2 : 3;
};

/** The study day before the test is a light final review (when there is more than one study day). */
export function finalReviewDate(cal: PlanCalendar): string | null {
  if (!cal.testDate || cal.studyDates.length < 2) return null;
  const last = cal.studyDates.at(-1)!;
  return daysBetween(last, cal.testDate) <= 2 ? last : null;
}

/** Weak skills first, then the rest of the pool, without duplicates. */
function weakFirst(pool: PracticeSlug[], weak: SkillId[]): PracticeSlug[] {
  const weakTypes = PRACTICE_TYPES.filter((t) => weak.includes(t.skill)).map((t) => t.slug);
  const head = pool.filter((s) => weakTypes.includes(s));
  const extra = weakTypes.filter((s) => !pool.includes(s)).slice(0, 2);
  return [...new Set([...head, ...extra, ...pool])];
}

/** Rule-based week outline (used immediately, and as the fallback if the AI pass fails). */
export function ruleWeeks(input: StudyPlanInput, cal: PlanCalendar): ScheduleWeek[] {
  // Two weeks or less (or very few study days): skip the phases and review everything.
  const shortPlan = cal.weekCount <= 2 || cal.studyDates.length <= 4;
  const finalDay = finalReviewDate(cal);
  // One mock test 3–6 days before the test, plus one every three weeks in long plans.
  const mockDates = new Set<string>();
  if (cal.testDate && cal.studyDates.length >= 4) {
    const candidate = [...cal.studyDates].reverse().find((d) => d !== finalDay && daysBetween(d, cal.testDate!) >= 3) ?? cal.studyDates.find((d) => d !== finalDay);
    if (candidate) mockDates.add(candidate);
  }
  if (cal.weekCount >= 6) {
    for (let w = 3; w <= cal.weekCount; w += 3) {
      const inWeek = cal.studyDates.filter((d) => weekOf(cal, d) === w && d !== finalDay);
      if (inWeek.length && ![...mockDates].some((m) => weekOf(cal, m) === w)) mockDates.add(inWeek.at(-1)!);
    }
  }
  return Array.from({ length: cal.weekCount }, (_, i) => {
    const week = i + 1;
    const p = shortPlan ? 3 : phaseIndex(week, cal.weekCount);
    const phase = PHASES[p];
    const pool = shortPlan ? PRACTICE_TYPES.map((t) => t.slug) : phase.tasks;
    const priorityTasks = weakFirst(pool, input.weakAreas).slice(0, 6);
    const focusSkills = [...new Set([...input.weakAreas, ...priorityTasks.map((s) => getPracticeType(s)!.skill)])].slice(0, 4) as SkillId[];
    const { start, end } = weekRange(cal, week);
    return {
      week,
      start,
      end,
      theme: shortPlan ? "Focused review before your test" : phase.title,
      focusSkills,
      priorityTasks,
      mockTestDate: [...mockDates].find((d) => weekOf(cal, d) === week) ?? null,
      tip: phase.tip,
    };
  });
}

const blockMinutes = (slug: PracticeSlug) => {
  const t = getPracticeType(slug)!;
  const raw = t.minutesPerItem >= 5 ? t.minutesPerItem : t.minutesPerItem * 4;
  return Math.min(25, Math.max(5, Math.round(raw / 5) * 5));
};
const practiceTask = (slug: PracticeSlug, minutes: number): ScheduleTask => ({ kind: "practice", slug, label: getPracticeType(slug)?.title ?? slug, href: practiceHref(slug), minutes });

/** Turns a week outline into dated days with tasks that fit the daily time budget. */
export function expandSchedule(input: StudyPlanInput, cal: PlanCalendar, weeks: ScheduleWeek[]): ScheduleDay[] {
  const finalDay = finalReviewDate(cal);
  const vocabMinutes = input.emphasis === "vocabulary" ? 15 : 10;
  const days: ScheduleDay[] = [];
  let rotation = 0;
  for (const date of cal.studyDates) {
    const week = weekOf(cal, date);
    const plan = weeks.find((w) => w.week === week) ?? weeks.at(-1)!;
    let type: ScheduleDay["type"] = "study";
    let tasks: ScheduleTask[];
    if (date === finalDay) {
      type = "final-review";
      tasks = [
        { kind: "review", slug: null, label: "Light review: look over your mistakes and notes", href: "/progress", minutes: 10 },
        { kind: "vocabulary", slug: null, label: "Review your saved vocabulary", href: "/vocabulary", minutes: 10 },
      ];
    } else if (date === plan.mockTestDate) {
      type = "mock-test";
      tasks = [
        { kind: "mock-test", slug: null, label: "Take a mock test", href: "/mock-test", minutes: MOCK_MINUTES },
        { kind: "review", slug: null, label: "Review the questions you missed", href: "/mock-test/results", minutes: 10 },
      ];
    } else {
      tasks = [];
      let budget = Math.max(5, input.dailyMinutes - vocabMinutes);
      const pool = plan.priorityTasks.length ? plan.priorityTasks : PHASES[0].tasks;
      for (let k = 0; k < pool.length && budget >= 5 && tasks.length < 4; k++) {
        const slug = pool[(rotation + k) % pool.length];
        if (tasks.some((t) => t.slug === slug)) continue;
        const minutes = Math.min(blockMinutes(slug), budget);
        tasks.push(practiceTask(slug, minutes));
        budget -= minutes;
      }
      rotation++;
      tasks.push({ kind: "vocabulary", slug: null, label: "Review 10 vocabulary words", href: "/vocabulary", minutes: vocabMinutes });
    }
    days.push({ date, weekday: weekdayOf(date), week, type, focus: plan.theme, tasks, minutes: tasks.reduce((n, t) => n + t.minutes, 0) });
  }
  if (cal.testDate) {
    days.push({ date: cal.testDate, weekday: weekdayOf(cal.testDate), week: weekOf(cal, cal.testDate), type: "test", focus: "Test day. Sleep well, eat well and arrive early. Good luck!", tasks: [], minutes: 0 });
  }
  return days;
}

/** Four overview phases with date ranges (kept for the plan overview card). */
function phasesFor(input: StudyPlanInput, cal: PlanCalendar): StudyPlanPhase[] {
  const weak = input.weakAreas.map((s) => SKILL_LABEL[s]).join(" and ");
  const label = (from: number, to: number) => {
    const a = shortDate(weekRange(cal, from).start);
    const b = shortDate(weekRange(cal, Math.max(from, to)).end);
    return a === b ? a : `${a} – ${b}`;
  };
  const bounds = [0, 1, 2, 3].map((p) => {
    const weeks = Array.from({ length: cal.weekCount }, (_, i) => i + 1).filter((w) => phaseIndex(w, cal.weekCount) === p);
    return weeks.length ? label(weeks[0], weeks.at(-1)!) : label(Math.min(cal.weekCount, p + 1), Math.min(cal.weekCount, p + 1));
  });
  return PHASES.map((p, i) => ({
    title: p.title,
    weeks: bounds[i],
    focus: i === 1 && weak ? `Longer texts and talks, with extra time for ${weak}.` : p.focus,
    tasks: i === 3 ? [{ slug: null, label: weak ? `Review ${weak} tasks` : "Review all task types" }, { slug: null, label: "Review saved vocabulary" }, { slug: null, label: "Take a mock test" }] : p.tasks.map((slug) => ({ slug, label: getPracticeType(slug)?.title ?? slug })),
  }));
}

export function buildStudyPlan(input: StudyPlanInput & { startDate?: string }, now = new Date()): StudyPlan {
  const startDate = resolveStartDate(input.startDate, now);
  const cal = planCalendar(input, startDate);
  const weeks = ruleWeeks(input, cal);
  return assemblePlan(input, cal, weeks, "rules", now);
}

/** Builds the stored plan from a calendar and a week outline (rules or AI). */
export function assemblePlan(input: StudyPlanInput, cal: PlanCalendar, weeks: ScheduleWeek[], source: "rules" | "ai", now = new Date()): StudyPlan {
  const schedule = expandSchedule(input, cal, weeks);
  const firstStudy = schedule.find((d) => d.type === "study") ?? schedule[0];
  return {
    id: `plan-${now.getTime()}`,
    input,
    createdAt: now.toISOString(),
    totalWeeks: cal.weekCount,
    phases: phasesFor(input, cal),
    dailyTasks: (firstStudy?.tasks ?? []).map((t, i) => ({ id: `daily-${t.slug ?? t.kind}-${i}`, label: t.label, href: t.href, minutes: t.minutes })),
    startDate: cal.startDate,
    endDate: cal.endDate,
    daysUntilTest: cal.daysUntilTest,
    weeks,
    schedule,
    scheduleSource: source,
  };
}

export const ALL_SKILLS = SKILLS.map((s) => s.id);
