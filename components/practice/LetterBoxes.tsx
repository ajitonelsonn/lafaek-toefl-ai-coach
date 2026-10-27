"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils/cn";

interface LetterBoxesProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  status: "unanswered" | "answered" | "correct" | "incorrect";
  disabled?: boolean;
}

/**
 * One box per missing letter (C-test style). Typing advances, Backspace and the
 * arrow keys move between boxes, and pasting fills several boxes at once.
 */
export function LetterBoxes({ length, value, onChange, label, status, disabled }: LetterBoxesProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const letters = Array.from({ length }, (_, i) => value[i] ?? "");
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const setAt = (i: number, raw: string) => {
    const clean = raw.replace(/[^A-Za-z]/g, "").toLowerCase();
    const next = [...letters];
    if (clean.length > 1) {
      clean.slice(0, length - i).split("").forEach((c, j) => (next[i + j] = c));
      onChange(next.join("").trimEnd());
      focus(i + clean.length);
      return;
    }
    next[i] = clean;
    // Keep the string contiguous: an emptied box in the middle becomes a space placeholder.
    onChange(next.map((c) => c || " ").join("").trimEnd());
    if (clean) focus(i + 1);
  };

  return (
    <span role="group" aria-label={label} className="ml-1.5 mr-1 inline-flex gap-1 align-middle">
      {letters.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={ch.trim()}
          onChange={(e) => setAt(i, e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !ch.trim() && i > 0) {
              e.preventDefault();
              setAt(i - 1, "");
              focus(i - 1);
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
          maxLength={length}
          aria-label={`${label}, letter ${i + 1} of ${length}`}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          disabled={disabled}
          className={cn(
            "h-11 w-9 rounded-lg border-2 bg-surface p-0 text-center text-xl font-semibold leading-none text-ink outline-none focus:border-primary focus:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus-visible:outline-none disabled:cursor-default sm:w-10",
            status === "correct" && "border-success bg-success-soft text-success",
            status === "incorrect" && "border-danger bg-danger-soft text-danger",
            (status === "answered" || status === "unanswered") && (ch.trim() ? "border-primary/60" : "border-line-strong"),
          )}
        />
      ))}
    </span>
  );
}
