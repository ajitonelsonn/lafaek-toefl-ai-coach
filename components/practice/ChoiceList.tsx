"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ChoiceQuestion } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";

interface ChoiceListProps {
  question: ChoiceQuestion;
  value: string | undefined;
  onChange: (id: string) => void;
  revealed?: boolean;
  number?: number;
  size?: "md" | "lg";
  hidePrompt?: boolean;
}

/** Single-answer question rendered as a native radio group. */
export function ChoiceList({ question, value, onChange, revealed, number, size = "md", hidePrompt }: ChoiceListProps) {
  const name = `q-${question.id}`;
  const isCorrect = value === question.answerId;
  return (
    <fieldset className="min-w-0">
      <legend className={cn("mb-3 flex items-start gap-3 font-semibold text-ink", hidePrompt && "sr-only")}>
        {number !== undefined && (
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm text-on-primary" aria-hidden>
            {number}
          </span>
        )}
        <span className={cn("pt-0.5", size === "lg" ? "text-lg" : "text-base")}>{question.prompt}</span>
      </legend>
      <div className="flex flex-col gap-2">
        {question.options.map((o) => {
          const selected = value === o.id;
          const showCorrect = revealed && o.id === question.answerId;
          const showWrong = revealed && selected && !isCorrect;
          return (
            <label
              key={o.id}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-xl border px-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/40",
                size === "lg" ? "py-3.5" : "py-2.5",
                !revealed && selected && "border-primary bg-primary-soft",
                !revealed && !selected && "border-line bg-surface hover:border-primary/60",
                showCorrect && "border-success bg-success-soft",
                showWrong && "border-danger bg-danger-soft",
                revealed && !showCorrect && !showWrong && "border-line bg-surface opacity-80",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={selected}
                onChange={() => onChange(o.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-primary" : "border-line-strong",
                )}
              >
                {selected && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  selected ? "bg-primary text-on-primary" : "bg-primary-soft text-primary",
                )}
              >
                {o.id}
              </span>
              <span className={cn("flex-1 text-body", size === "lg" ? "text-base" : "text-[15px]", selected && "font-semibold text-ink")}>{o.text}</span>
              {showCorrect && <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Correct answer" />}
              {showWrong && <XCircle className="size-5 shrink-0 text-danger" aria-label="Your answer is incorrect" />}
            </label>
          );
        })}
      </div>
      {revealed && (
        <div className={cn("mt-3 rounded-xl p-3 text-sm", value === undefined ? "bg-surface-muted" : isCorrect ? "bg-success-soft" : "bg-danger-soft")} role="status">
          <p className="font-bold text-ink">
            {value === undefined ? "Not answered." : isCorrect ? "Correct!" : `Not quite. The answer is ${question.answerId}.`}
          </p>
          <p className="mt-0.5 text-body">{question.explanation}</p>
        </div>
      )}
    </fieldset>
  );
}
