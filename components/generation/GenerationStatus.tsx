"use client";

import { CheckCircle2, CircleDashed, Clock3, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import type { GenerationJob, GenerationState } from "@/lib/services/types";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatRelative } from "@/lib/utils/format";
import { useHydrated } from "@/lib/store/demo-store";

const META: Record<GenerationState, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  not_started: { label: "Not started", tone: "neutral", icon: <CircleDashed aria-hidden /> },
  queued: { label: "Queued", tone: "primary", icon: <Clock3 aria-hidden /> },
  generating: { label: "Generating", tone: "primary", icon: <Loader2 className="animate-spin" aria-hidden /> },
  ready: { label: "Ready", tone: "success", icon: <CheckCircle2 aria-hidden /> },
  failed: { label: "Needs retry", tone: "danger", icon: <TriangleAlert aria-hidden /> },
};

export function GenerationBadge({ state }: { state: GenerationState }) {
  const m = META[state];
  return (
    <StatusBadge tone={m.tone} icon={m.icon}>
      {m.label}
    </StatusBadge>
  );
}

interface GenerationStatusProps {
  state: GenerationState;
  progress?: number;
  updatedAt?: string;
  itemsReady?: number;
  itemsTotal?: number;
  onRetry?: () => void;
  error?: string;
}

/** Compact status: label, optional progress bar, last-updated text and retry for failures. */
export function GenerationStatus({ state, progress = 0, updatedAt, itemsReady, itemsTotal, onRetry, error }: GenerationStatusProps) {
  const hydrated = useHydrated();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GenerationBadge state={state} />
        {itemsTotal !== undefined && (state === "generating" || state === "ready") && (
          <span className="text-xs font-semibold text-muted tabular-nums">
            {itemsReady ?? 0}/{itemsTotal} items
          </span>
        )}
      </div>
      {(state === "generating" || state === "queued") && <ProgressBar value={progress} label="Generation progress" size="sm" />}
      {state === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-danger">{error ?? "Generation stopped."}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <RotateCcw className="size-3.5" aria-hidden /> Retry
            </button>
          )}
        </div>
      )}
      {updatedAt && hydrated && <span className="text-xs text-muted">Updated {formatRelative(updatedAt)}</span>}
    </div>
  );
}

export function jobFor(jobs: GenerationJob[], slug: string): GenerationJob | undefined {
  return jobs.find((j) => j.slug === slug);
}
