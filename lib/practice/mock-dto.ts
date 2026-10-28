// Client-safe mock test result types (no answer keys).
import type { SkillId } from "@/lib/config/practice-types";
import type { WritingCheckDTO } from "./dto";

export interface MockSectionResultDTO {
  skill: SkillId;
  correct: number | null;
  total: number;
  answered: number;
  /** Practice band (1–6): from accuracy for Reading and Listening, AI-rated for Writing and Speaking. */
  band: number | null;
  note?: string;
  checks?: WritingCheckDTO[];
  /** Short AI comments on Writing and Speaking answers, one per answer. */
  comments?: string[];
}

/** AI rating of Writing and Speaking: null for tests without them (or from before AI rating). */
export type MockScoringStatus = "pending" | "done" | "failed" | null;

export interface MockResultDTO {
  id: string;
  completedAt: string;
  durationSeconds: number;
  sections: MockSectionResultDTO[];
  /** Average of the section bands; null while Writing and Speaking are still being rated. */
  estimatedBand: number | null;
  scoring: MockScoringStatus;
  /** Share of questions (0–1) that came from the learner's personalised practice. */
  personalised: number;
  /** Public ID of the certificate issued for this test, if any. */
  certificateCode: string | null;
}
