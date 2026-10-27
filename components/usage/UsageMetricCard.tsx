import type { Icon3DName } from "@/lib/config/assets";
import { Icon3D } from "@/components/ui/Icon3D";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface UsageMetricView {
  id: string;
  label: string;
  value: string;
  icon: Icon3DName;
  note: string;
  estimate?: boolean;
}

export function UsageMetricCard({ metric }: { metric: UsageMetricView }) {
  return (
    <article className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft" aria-hidden>
          <Icon3D name={metric.icon} size={26} />
        </span>
        <h3 className="text-sm font-semibold text-muted">{metric.label}</h3>
        {metric.estimate && <StatusBadge tone="warning" className="ml-auto">Estimate</StatusBadge>}
      </div>
      <p className="text-3xl font-bold text-ink tabular-nums">{metric.value}</p>
      <p className="text-xs text-muted">{metric.note}</p>
    </article>
  );
}
