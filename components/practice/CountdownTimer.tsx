"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface CountdownTimerProps {
  totalSeconds: number;
  onExpire?: () => void;
  /** Stops the clock (e.g. after the set is finished). */
  stopped?: boolean;
  title?: string;
  compact?: boolean;
  /** False under test conditions (mock test): the timer cannot be paused. */
  pausable?: boolean;
}

/** Practice countdown. Remount (change `key`) to restart it. */
export function CountdownTimer({ totalSeconds, onExpire, stopped, title = "Time Remaining", compact, pausable = true }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const running = !paused && !stopped && remaining > 0;

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && !expired.current) {
      expired.current = true;
      onExpireRef.current?.();
    }
  }, [remaining]);

  const low = remaining <= Math.min(60, totalSeconds * 0.15);
  const announcement = remaining === 60 ? "One minute remaining." : remaining === 0 ? "Time is up." : "";

  return (
    <section aria-label={title} className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", compact ? "p-4" : "p-5")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Clock className="size-5 text-primary" aria-hidden />
          {title}
        </h2>
        {pausable && !stopped && remaining > 0 && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
            aria-label={paused ? "Resume timer" : "Pause timer"}
          >
            {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
            {paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>
      <p className={cn("mt-2 font-bold tabular-nums tracking-tight", compact ? "text-3xl" : "text-4xl", low ? "text-danger" : "text-ink")} aria-hidden>
        {formatClock(remaining)}
      </p>
      <p className="sr-only">{formatClock(remaining)} remaining</p>
      <ProgressBar value={remaining} max={totalSeconds} tone={low ? "danger" : "primary"} label="Time remaining" className="mt-3" />
      {remaining === 0 && <p className="mt-2 text-sm font-semibold text-danger">Time is up. You can still finish and review your answers.</p>}
      {paused && remaining > 0 && <p className="mt-2 text-sm text-muted">Timer paused.</p>}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
