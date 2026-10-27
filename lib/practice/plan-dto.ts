// Client-safe study plan DTO.
import type { StudyPlan } from "@/lib/services/types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";

export type StudyPlanDTO = Omit<StudyPlan, "input"> & { input: StudyPlanInputBody; version: number };
