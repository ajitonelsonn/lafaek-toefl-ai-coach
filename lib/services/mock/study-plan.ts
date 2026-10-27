// Rule-based study-plan builder used while AI generation is not connected.
import { PRACTICE_TYPES, getPracticeType, practiceHref, type PracticeSlug, type SkillId } from "@/lib/config/practice-types";
import type { StudyPlan, StudyPlanInput, StudyPlanPhase, StudyPlanService } from "@/lib/services/types";

const PHASE_ORDER: PracticeSlug[][] = [
  ["complete-the-words", "read-in-daily-life", "build-sentence", "listen-choose-response"],
  ["read-academic-passage", "listen-conversation", "listen-announcement", "listen-repeat"],
  ["listen-academic-talk", "write-email", "academic-discussion", "take-interview"],
];

const SKILL_LABEL: Record<SkillId, string> = { reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking" };

function weeksFor(input: StudyPlanInput, now: Date): number {
  if (input.testDate) {
    const days = (new Date(input.testDate).getTime() - now.getTime()) / 86_400_000;
    return Math.min(16, Math.max(2, Math.round(days / 7)));
  }
  return { beginner: 12, intermediate: 10, "upper-intermediate": 8, advanced: 6 }[input.level];
}

function weekRanges(total: number, parts: number): string[] {
  const size = total / parts;
  return Array.from({ length: parts }, (_, i) => {
    const start = Math.floor(i * size) + 1;
    const end = Math.max(start, Math.floor((i + 1) * size));
    return start === end ? `Week ${start}` : `Week ${start}–${end}`;
  });
}

export function buildStudyPlan(input: StudyPlanInput, now = new Date()): StudyPlan {
  const totalWeeks = weeksFor(input, now);
  const ranges = weekRanges(totalWeeks, 4);
  const weak = input.weakAreas.map((s) => SKILL_LABEL[s]).join(" and ");

  const toTasks = (slugs: PracticeSlug[]) =>
    slugs.map((slug) => ({ slug, label: getPracticeType(slug)?.title ?? slug }));

  const phases: StudyPlanPhase[] = [
    { title: "Build Foundation", weeks: ranges[0], focus: "Start with shorter tasks to build confidence.", tasks: toTasks(PHASE_ORDER[0]) },
    {
      title: "Improve Skills",
      weeks: ranges[1],
      focus: weak ? `Longer texts and talks, with extra time for ${weak}.` : "Longer texts and talks to improve accuracy.",
      tasks: toTasks(PHASE_ORDER[1]),
    },
    { title: "Expand Practice", weeks: ranges[2], focus: "Writing, interviews, and the most challenging listening.", tasks: toTasks(PHASE_ORDER[2]) },
    {
      title: "Test & Review",
      weeks: ranges[3],
      focus: "Review weak areas and take full mock tests.",
      tasks: [
        { slug: null, label: weak ? `Review ${weak} tasks` : "Review all task types" },
        { slug: null, label: "Review saved vocabulary" },
        { slug: null, label: "Take a full mock test" },
      ],
    },
  ];

  // Daily tasks: weakest skills first, then the first phase, within the daily time budget.
  const weakTypes = PRACTICE_TYPES.filter((t) => input.weakAreas.includes(t.skill));
  const firstPhase = PHASE_ORDER[0].map((s) => getPracticeType(s)!).filter(Boolean);
  const candidates = [...weakTypes, ...firstPhase].filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i);
  const vocabMinutes = input.emphasis === "vocabulary" ? 15 : 10;
  let budget = Math.max(10, input.dailyMinutes - vocabMinutes);
  const dailyTasks: StudyPlan["dailyTasks"] = [];
  for (const t of candidates) {
    const minutes = Math.max(5, Math.round(t.minutesPerItem * (t.minutesPerItem >= 5 ? 1 : 5)));
    if (minutes > budget && dailyTasks.length > 0) continue;
    dailyTasks.push({ id: `daily-${t.slug}`, label: t.title, href: practiceHref(t.slug), minutes });
    budget -= minutes;
    if (dailyTasks.length >= 3 || budget <= 0) break;
  }
  dailyTasks.push({ id: "daily-vocabulary", label: "Review 10 vocabulary words", href: "/vocabulary", minutes: vocabMinutes });

  return {
    id: `plan-${now.getTime()}`,
    input,
    createdAt: now.toISOString(),
    totalWeeks,
    phases,
    dailyTasks,
  };
}

export const mockStudyPlanService: StudyPlanService = {
  async createPlan(input) {
    return buildStudyPlan(input);
  },
};
