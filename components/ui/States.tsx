import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface-soft px-6 py-10 text-center", className)}>
      {icon && <div className="text-primary">{icon}</div>}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted", className)}>
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action, className }: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft px-6 py-8 text-center", className)}>
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <h3 className="font-bold text-ink">{title}</h3>
      {description && <p className="max-w-md text-sm text-body">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}
