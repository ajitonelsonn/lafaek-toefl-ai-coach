"use client";

import { useRef } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { gsap, useMotion } from "@/lib/client/motion";
import { PRACTICE_TYPES, practiceHref, type PracticeType } from "@/lib/config/practice-types";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { Icon3D } from "@/components/ui/Icon3D";
import { percent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const CONFETTI = Array.from({ length: 22 }, (_, i) => ["bg-primary", "bg-success", "bg-warning", "bg-speaking", "bg-writing", "bg-listening"][i % 6]);

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

  const panel = useRef<HTMLElement>(null);
  const celebrate = pct >= 80;
  useMotion(panel, (el) => {
    gsap.from(el, { y: 18, scale: 0.97, autoAlpha: 0, duration: 0.5, ease: "back.out(1.6)", clearProps: "transform,opacity,visibility" });
    gsap.from("[data-results-icon]", { scale: 0, rotation: -30, duration: 0.6, delay: 0.25, ease: "back.out(3)" });
    if (!celebrate) return;
    // A short confetti burst from the score ring.
    const pieces = gsap.utils.toArray<HTMLElement>("[data-confetti]");
    gsap.set(pieces, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
    gsap.to(pieces, {
      x: () => gsap.utils.random(-150, 150),
      y: () => gsap.utils.random(-130, 40),
      rotation: () => gsap.utils.random(-260, 260),
      scale: () => gsap.utils.random(0.6, 1.2),
      autoAlpha: 0,
      duration: () => gsap.utils.random(0.9, 1.5),
      delay: 0.3,
      ease: "power3.out",
    });
  }, []);

  return (
    <section ref={panel} aria-labelledby="results-title" className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary-soft to-surface p-5 sm:p-6" role="status">
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="relative shrink-0">
          <ProgressRing value={pct} label={correct !== null ? `${correct} of ${total} correct` : `${answered} of ${total} answered`} size={116}>
            <span className="text-2xl font-extrabold text-ink tabular-nums">{correct !== null ? `${correct}/${total}` : `${answered}/${total}`}</span>
            <span className="text-xs text-muted">{correct !== null ? "correct" : "completed"}</span>
          </ProgressRing>
          {celebrate && (
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
              {CONFETTI.map((color, k) => (
                <span key={k} data-confetti className={cn("invisible absolute size-2 rounded-[2px]", color, k % 3 === 0 && "rounded-full")} />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span data-results-icon className="inline-flex">
              <Icon3D name={pct >= 80 ? "achievement" : "success"} size={28} />
            </span>
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
