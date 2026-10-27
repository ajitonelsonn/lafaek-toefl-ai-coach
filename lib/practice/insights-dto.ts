// Client-safe progress and usage DTOs (computed on the server from PostgreSQL).
import type { PracticeSlug, SkillId } from "@/lib/config/practice-types";

export interface ProgressDTO {
  questionsAttempted: number;
  objectiveAnswered: number;
  objectiveCorrect: number;
  accuracy: number | null;
  practiceMinutes: number;
  typesTried: number;
  practisedDates: string[];
  trend: { date: string; accuracy: number; answered: number }[];
  bySkill: { skill: SkillId; accuracy: number | null; answered: number }[];
  byTask: { slug: PracticeSlug; attemptedUnits: number; availableUnits: number; lastPractisedAt: string | null }[];
  recent: { date: string; slug: PracticeSlug; topic: string; correct: number | null; total: number; minutes: number | null }[];
}

export interface UsageDTO {
  range: "7d" | "30d" | "all";
  text: { requests: number; inputTokens: number | null; outputTokens: number | null; tokensReported: boolean };
  images: { generated: number };
  speech: { clips: number; characters: number; estimatedSeconds: number; isEstimate: true };
  transcription: { requests: number; audioSeconds: number };
  feedback: { requests: number };
  generation: { itemsGenerated: number; jobsCompleted: number; jobsFailed: number; jobsPending: number };
  storage: { assets: number; bytes: number };
  practice: { attempts: number };
  cost: { estimated: null; note: string };
  daily: { date: string; requests: number }[];
  dailyItemLimit: number | null;
}
