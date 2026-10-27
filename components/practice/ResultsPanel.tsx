"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { PRACTICE_TYPES, practiceHref, type PracticeType } from "@/lib/config/practice-types";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { Icon3D } from "@/components/ui/Icon3D";
import { percent } from "@/lib/utils/format";

interface ResultsPanelProps {
  type: PracticeType;
  correct: number | null;
  total: number;
  answered: number;
  onRetry: () => void;
  note?: string;
}

/** Summary shown after finishing a set. Answers stay visible below for review. */
export function ResultsPanel({ type, correct, total, answered, onRetry, note }: ResultsPanelProps) {
  const idx = PRACTICE_TYPES.findIndex((t) => t.slug === type.slug);
  const next = PRACTICE_TYPES[(idx + 1) % PRACTICE_TYPES.length];
  const pct = correct !== null ? percent(correct, total) : percent(answered, total);
  const message =
    correct === null
      ? "Nice work finishing this practice set."
      : pct >= 80
        ? "Excellent work! Keep it up."
        : pct >= 50
          ? "Good effort. Review the explanations below."
          : "Keep practising. The explanations below will help.";

  return (
    <section aria-labelledby="results-title" className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary-soft to-surface p-5 sm:p-6" role="status">
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <ProgressRing value={pct} label={correct !== null ? `${correct} of ${total} correct` : `${answered} of ${total} answered`} size={116}>
          <span className="text-2xl font-extrabold text-ink tabular-nums">{correct !== null ? `${correct}/${total}` : `${answered}/${total}`}</span>
          <span className="text-xs text-muted">{correct !== null ? "correct" : "completed"}</span>
        </ProgressRing>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <Icon3D name={pct >= 80 ? "achievement" : "success"} size={28} />
            <h2 id="results-title" className="text-xl font-bold text-ink">
              Practice complete
            </h2>
          </div>
          <p className="mt-1 text-body">{message}</p>
          {note && <p className="mt-1 text-sm text-muted">{note}</p>}
          <p className="mt-1 text-xs text-muted">Practice result — not an official TOEFL score.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button variant="secondary" leftIcon={<RotateCcw className="size-4" />} onClick={onRetry}>
              Try again
            </Button>
            <LinkButton href={practiceHref(next.slug)} rightIcon={<ArrowRight className="size-4" />}>
              Next: {next.shortTitle}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
