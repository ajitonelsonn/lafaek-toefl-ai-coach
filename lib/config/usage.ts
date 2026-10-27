import type { UsageMetricId } from "@/lib/services/types";

/**
 * Per-account usage limits. `null` means "no limit configured" and the UI
 * hides limit bars for that metric. Phase 1 values are demo placeholders;
 * a backend should supply real values later.
 */
export const USAGE_LIMITS: Record<UsageMetricId, number | null> = {
  "ai-tokens": 500_000,
  "image-generations": 200,
  "audio-minutes": 120,
  "ai-requests": null,
  "questions-generated": null,
  "practice-sessions": null,
  "study-time": null,
};
