import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "reading" | "listening" | "writing" | "speaking";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  reading: "bg-reading-soft text-reading",
  listening: "bg-listening-soft text-listening",
  writing: "bg-writing-soft text-writing",
  speaking: "bg-speaking-soft text-speaking",
};

export function StatusBadge({ tone = "neutral", icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold [&>svg]:size-3.5", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
