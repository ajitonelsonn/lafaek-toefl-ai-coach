import type { UsageMetric } from "@/lib/services/types";
import type { Icon3DName } from "@/lib/config/assets";
import { Icon3D } from "@/components/ui/Icon3D";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMinutes, formatNumber, percent } from "@/lib/utils/format";

export const METRIC_ICON: Record<UsageMetric["id"], Icon3DName> = {
  "ai-tokens": "ai-coach",
  "image-generations": "image",
  "audio-minutes": "audio",
  "ai-requests": "message",
  "questions-generated": "quiz",
  "practice-sessions": "practice-test",
  "study-time": "history",
};

export function formatMetric(m: Pick<UsageMetric, "id" | "unit">, value: number) {
  if (m.id === "study-time") return formatMinutes(value);
  return `${formatNumber(value)}${m.unit ? ` ${m.unit}` : ""}`;
}

export function UsageMetricCard({ metric }: { metric: UsageMetric }) {
  const pct = metric.limit ? percent(metric.value, metric.limit) : null;
  return (
    <article className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft" aria-hidden>
          <Icon3D name={METRIC_ICON[metric.id]} size={26} />
        </span>
        <h3 className="text-sm font-semibold text-muted">{metric.label}</h3>
      </div>
      <p className="text-3xl font-bold text-ink tabular-nums">{formatMetric(metric, metric.value)}</p>
      {metric.limit !== null && pct !== null ? (
        <>
          <p className="text-xs text-muted">
            of {formatMetric(metric, metric.limit)} limit
          </p>
          <ProgressBar value={metric.value} max={metric.limit} tone={pct >= 90 ? "danger" : pct >= 75 ? "warning" : "primary"} label={`${metric.label}: ${pct}% of limit`} showValue size="sm" />
        </>
      ) : (
        <p className="text-xs text-muted">{metric.description}</p>
      )}
    </article>
  );
}
