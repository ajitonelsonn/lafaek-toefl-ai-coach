// Client-safe Profile page data.
import type { Icon3DName } from "@/lib/config/assets";
import type { Weekday } from "@/lib/services/types";

export interface AchievementDTO {
  id: string;
  title: string;
  description: string;
  icon: Icon3DName;
  earned: boolean;
  /** e.g. "4 / 7 days" while not earned yet. */
  progress: string | null;
}

export interface ProfileOverviewDTO {
  plan: { planCredits: number; mockCredits: number; packs: number; used: { studyPlans: number; mockTests: number }; grants: { date: string; packs: number; planCredits: number; mockCredits: number }[] };
  goal: { targetScore: number; testDate: string | null; studyDays: Weekday[]; dailyMinutes: number; totalWeeks: number } | null;
  bestMock: { band: number | null; tests: number; latest: string } | null;
  achievements: AchievementDTO[];
}
