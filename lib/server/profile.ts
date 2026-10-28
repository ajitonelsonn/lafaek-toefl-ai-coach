import "server-only";
import type { AchievementDTO, ProfileOverviewDTO } from "@/lib/practice/profile-dto";
import { db } from "./db";
import { getAccountPlan } from "./credits";
import { getActivePlan } from "./study-plan";
import { getProgress } from "./insights";
import { mockHistory } from "./mock-test";

/** Longest run of consecutive practice days (dates as YYYY-MM-DD). */
export function longestStreak(dates: string[]): number {
  const days = [...new Set(dates)].sort().map((d) => Date.parse(`${d}T12:00:00Z`) / 86_400_000);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && Math.round(days[i] - days[i - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Everything the Profile page shows besides the name form: plan, goal, best mock test, achievements. */
export async function getProfileOverview(userId: string): Promise<ProfileOverviewDTO> {
  const [plan, studyPlan, progress, mocks, words] = await Promise.all([
    getAccountPlan(userId),
    getActivePlan(userId),
    getProgress(userId),
    mockHistory(userId, 50),
    db.vocabularyWord.count({ where: { userId } }),
  ]);

  const typesDone = progress.byTask.filter((t) => t.availableUnits > 0 && t.doneUnits >= t.availableUnits).length;
  const streak = longestStreak(progress.practisedDates);
  const bands = mocks.map((m) => m.estimatedBand).filter((b): b is number => b !== null);
  const of = (n: number, goal: number, unit: string) => (n >= goal ? null : `${Math.min(n, goal)} / ${goal} ${unit}`);

  const achievements: AchievementDTO[] = [
    { id: "plan", title: "Planner", description: "Made your first study plan.", icon: "calendar", earned: plan.used.studyPlans > 0, progress: null },
    { id: "mock", title: "Test taker", description: "Finished your first mock test.", icon: "practice-test", earned: mocks.length > 0, progress: null },
    { id: "type", title: "Finisher", description: "Completed every question of one practice type.", icon: "success", earned: typesDone >= 1, progress: null },
    { id: "all12", title: "All-rounder", description: "Completed all 12 practice types.", icon: "achievement", earned: typesDone >= 12, progress: of(typesDone, 12, "types") },
    { id: "streak", title: "On fire", description: "Practised 7 days in a row.", icon: "streak", earned: streak >= 7, progress: of(streak, 7, "days") },
    { id: "words", title: "Word collector", description: "Collected 50 vocabulary words.", icon: "reading", earned: words >= 50, progress: of(words, 50, "words") },
  ];

  return {
    plan,
    goal: studyPlan
      ? {
          targetScore: studyPlan.input.targetScore,
          testDate: studyPlan.input.testDate ?? null,
          studyDays: studyPlan.input.studyDays,
          dailyMinutes: studyPlan.input.dailyMinutes,
          totalWeeks: studyPlan.totalWeeks,
        }
      : null,
    bestMock: bands.length ? { band: Math.max(...bands), tests: mocks.length, latest: mocks[0].completedAt } : mocks.length ? { band: null, tests: mocks.length, latest: mocks[0].completedAt } : null,
    achievements,
  };
}
