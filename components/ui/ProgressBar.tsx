import { cn } from "@/lib/utils/cn";

export type Tone = "primary" | "success" | "warning" | "danger" | "reading" | "listening" | "writing" | "speaking" | "muted";

const fill: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  reading: "bg-reading",
  listening: "bg-listening",
  writing: "bg-writing",
  speaking: "bg-speaking",
  muted: "bg-line-strong",
};

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: Tone;
  label: string;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ value, max = 100, tone = "primary", label, showValue, size = "md", className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        className={cn("w-full overflow-hidden rounded-full bg-line/70", size === "sm" ? "h-1.5" : "h-2.5")}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", fill[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showValue && <span className="w-10 shrink-0 text-right text-sm font-semibold text-ink tabular-nums">{Math.round(pct)}%</span>}
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: React.ReactNode;
  tone?: Tone;
}

const strokeColor: Record<Tone, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  reading: "var(--reading)",
  listening: "var(--listening)",
  writing: "var(--writing)",
  speaking: "var(--speaking)",
  muted: "var(--line-strong)",
};

export function ProgressRing({ value, max = 100, size = 112, stroke = 10, label, children, tone = "primary" }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
