"use client";

import { Flag } from "lucide-react";
import type { UnitStatus } from "./usePracticeSession";
import { cn } from "@/lib/utils/cn";

export interface NavItemState {
  id: string;
  status: UnitStatus;
  flagged?: boolean;
}

const STATUS_LABEL: Record<UnitStatus, string> = {
  unanswered: "not answered",
  answered: "answered",
  correct: "correct",
  incorrect: "incorrect",
};

interface QuestionNavigationProps {
  title?: string;
  /** False under test conditions (mock test): no Correct/Incorrect counts while answering. */
  showScores?: boolean;
  items: NavItemState[];
  current: number;
  onSelect: (index: number) => void;
}

export function QuestionNavigation({ title = "Question Navigator", items, current, onSelect, showScores = true }: QuestionNavigationProps) {
  const counts = {
    answered: items.filter((i) => i.status === "answered").length,
    unanswered: items.filter((i) => i.status === "unanswered").length,
    correct: items.filter((i) => i.status === "correct").length,
    incorrect: items.filter((i) => i.status === "incorrect").length,
    flagged: items.filter((i) => i.flagged).length,
  };

  return (
    <section aria-label={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <span className="text-sm font-semibold text-ink tabular-nums">
          {current + 1} / {items.length}
        </span>
      </div>
      <ol className="grid grid-cols-5 gap-2.5">
        {items.map((item, i) => {
          const isCurrent = i === current;
          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${STATUS_LABEL[item.status]}${item.flagged ? ", marked for review" : ""}`}
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  isCurrent && "border-primary bg-primary text-on-primary shadow-sm",
                  !isCurrent && item.status === "unanswered" && "border-line bg-surface-soft text-body hover:border-primary",
                  !isCurrent && item.status === "answered" && "border-primary/40 bg-primary-soft text-primary",
                  !isCurrent && item.status === "correct" && "border-success/40 bg-success-soft text-success",
                  !isCurrent && item.status === "incorrect" && "border-danger/40 bg-danger-soft text-danger",
                )}
              >
                {i + 1}
              </button>
              {item.flagged && <Flag className="absolute -right-0.5 -top-0.5 size-3.5 fill-warning text-warning" aria-hidden />}
            </li>
          );
        })}
      </ol>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <LegendRow color="bg-primary" label="Current" value={1} />
        <LegendRow color="bg-surface-muted border border-line" label="Not answered" value={counts.unanswered} />
        <LegendRow color="bg-primary-soft border border-primary/40" label="Answered" value={counts.answered} />
        {showScores && <LegendRow color="bg-success" label="Correct" value={counts.correct} />}
        {showScores && <LegendRow color="bg-danger" label="Incorrect" value={counts.incorrect} />}
        <LegendRow color="bg-warning" label="For review" value={counts.flagged} />
      </dl>
    </section>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-muted">
        <span className={cn("size-3 rounded-full", color)} aria-hidden />
        {label}
      </dt>
      <dd className="font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
