// DEMO DATA — illustrative usage numbers. Real values will come from the backend.
import { USAGE_LIMITS } from "@/lib/config/usage";
import type { UsageMetric, UsageMetricId, UsageRange, UsageSummary } from "@/lib/services/types";

const BASE: Record<UsageRange, Record<UsageMetricId, number>> = {
  "7d": { "ai-tokens": 9_420, "image-generations": 6, "audio-minutes": 14, "ai-requests": 61, "questions-generated": 38, "practice-sessions": 9, "study-time": 140 },
  "30d": { "ai-tokens": 31_800, "image-generations": 22, "audio-minutes": 46, "ai-requests": 212, "questions-generated": 117, "practice-sessions": 27, "study-time": 410 },
  all: { "ai-tokens": 48_250, "image-generations": 37, "audio-minutes": 71, "ai-requests": 318, "questions-generated": 156, "practice-sessions": 41, "study-time": 615 },
};

const META: Record<UsageMetricId, { label: string; unit?: string; description: string }> = {
  "ai-tokens": { label: "AI tokens used", description: "Text processed by the AI coach for questions and feedback." },
  "image-generations": { label: "Image generations", description: "Illustrations created for practice questions." },
  "audio-minutes": { label: "Audio generated", unit: "min", description: "Minutes of listening and speaking audio created." },
  "ai-requests": { label: "AI requests", description: "Calls made to the AI service from your account." },
  "questions-generated": { label: "Questions generated", description: "Practice questions created for your study plan." },
  "practice-sessions": { label: "Practice sessions", description: "Practice sets you started." },
  "study-time": { label: "Time spent practising", unit: "min", description: "Total time on practice pages." },
};

const DAYS: Record<UsageRange, number> = { "7d": 7, "30d": 30, all: 30 };

export function buildUsageSummary(range: UsageRange, today = new Date("2026-10-27T00:00:00Z")): UsageSummary {
  const values = BASE[range];
  const metrics: UsageMetric[] = (Object.keys(META) as UsageMetricId[]).map((id) => ({
    id,
    label: META[id].label,
    unit: META[id].unit,
    description: META[id].description,
    value: values[id],
    limit: USAGE_LIMITS[id],
  }));
  const days = DAYS[range];
  const perDay = values["ai-requests"] / days;
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    // Deterministic wave so server and client render the same values.
    const wave = 0.55 + 0.45 * Math.abs(Math.sin((i + 1) * 1.7));
    return { date: d.toISOString().slice(0, 10), requests: Math.round(perDay * wave * 1.3) };
  });
  return { range, metrics, daily, isDemo: true };
}
