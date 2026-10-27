// Client-safe study plan DTO.
import type { StudyPlan } from "@/lib/services/types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";

export type StudyPlanDTO = Omit<StudyPlan, "input"> & {
  input: StudyPlanInputBody;
  version: number;
  /** ISO time when a new plan may be made (one plan per STUDY_PLAN_COOLDOWN_DAYS); null when allowed now. */
  nextPlanAt: string | null;
};
