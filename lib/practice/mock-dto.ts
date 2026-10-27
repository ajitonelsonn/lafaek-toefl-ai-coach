// Client-safe mock test result types (no answer keys).
import type { SkillId } from "@/lib/config/practice-types";
import type { WritingCheckDTO } from "./dto";

export interface MockSectionResultDTO {
  skill: SkillId;
  correct: number | null;
  total: number;
  answered: number;
  /** Rough practice band (1–6) for auto-scored sections. */
  band: number | null;
  note?: string;
  checks?: WritingCheckDTO[];
}

export interface MockResultDTO {
  id: string;
  completedAt: string;
  durationSeconds: number;
  sections: MockSectionResultDTO[];
  /** Average of the auto-scored section bands (Reading/Listening), when there is at least one. */
  estimatedBand: number | null;
  /** Share of questions (0–1) that came from the learner's personalised practice. */
  personalised: number;
}
