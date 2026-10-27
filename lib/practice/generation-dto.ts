// Client-safe generation status (derived from PostgreSQL by the server).
import type { PracticeSlug } from "@/lib/config/practice-types";

export type GenerationStateDTO = "not_started" | "queued" | "generating" | "ready" | "failed" | "blocked";

export interface GenerationTaskDTO {
  slug: PracticeSlug;
  state: GenerationStateDTO;
  itemsReady: number;
  itemsTotal: number;
  updatedAt: string;
  message: string | null;
  canRetry: boolean;
  media: { audio: GenerationStateDTO | null; image: GenerationStateDTO | null };
}

export interface GenerationBatchDTO {
  id: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: string;
  tasks: GenerationTaskDTO[];
}
