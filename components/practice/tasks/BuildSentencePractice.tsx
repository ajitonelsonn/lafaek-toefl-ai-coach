"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Lightbulb, RotateCcw, SkipForward, XCircle } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { BuildSentenceSet, SentencePart } from "@/lib/services/types";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { Button } from "@/components/ui/Button";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { CountdownTimer } from "../CountdownTimer";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { SampleSetCard } from "../SampleSetCard";
import { usePracticeSession } from "../usePracticeSession";
import { cn } from "@/lib/utils/cn";

/** One entry per answer slot: the index of the token placed there, or null when empty. */
type Slots = (number | null)[];

/** Deterministic shuffle so server and client render the same word bank. */
function shuffledIndexes(n: number, seedText: string): number[] {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  // Never show the words already in the correct order.
  if (idx.every((v, i) => v === i) && n > 1) [idx[0], idx[1]] = [idx[1], idx[0]];
  return idx;
}

const ROLE_STYLE: Record<SentencePart["role"], { label: string; className: string }> = {
  opener: { label: "Question opener", className: "bg-reading-soft text-reading" },
  connector: { label: "Connector", className: "bg-speaking-soft text-speaking" },
  subject: { label: "Subject", className: "bg-primary-soft text-primary" },
  verb: { label: "Verb", className: "bg-writing-soft text-writing" },
  object: { label: "Object", className: "bg-listening-soft text-listening" },
  rest: { label: "Rest", className: "bg-surface-muted text-body" },
};

export function BuildSentencePractice({ type, content, sampleCount }: { type: PracticeType; content: BuildSentenceSet; sampleCount: number }) {
  const items = content.items;
  const unitIds = useMemo(() => items.map((i) => i.id), [items]);
  const grade = useCallback(
    (id: string, value: unknown) => {
      const item = items.find((i) => i.id === id)!;
      const slots = value as Slots;
      return slots.length === item.tokens.length && slots.every((v, i) => v === i);
    },
    [items],
  );
  const s = usePracticeSession<Slots>({ slug: type.slug, unitIds, grade });
  const [dragToken, setDragToken] = useState<number | null>(null);

  const item = items[s.index];
  const slots: Slots = s.answers[item.id] ?? Array(item.tokens.length).fill(null);
  const revealed = !!s.checked[item.id];
  const status = s.statusOf(item.id);
  const bankOrder = useMemo(() => shuffledIndexes(item.tokens.length, item.id), [item]);
  const bank = bankOrder.filter((t) => !slots.includes(t));
  const isLast = s.index === items.length - 1;
  const complete = slots.every((v) => v !== null);

  const setSlots = (next: Slots) => s.answer(item.id, next.some((v) => v !== null) ? next : undefined);
  /** Places a token in a slot (default: the first empty one). A token already in that slot goes back to the bank. */
  const place = (token: number, slot?: number) => {
    if (revealed) return;
    const next = slots.map((v) => (v === token ? null : v));
    const target = slot ?? next.findIndex((v) => v === null);
    if (target < 0) return;
    next[target] = token;
    setSlots(next);
  };
  const clearSlot = (slot: number) => {
    if (revealed) return;
    setSlots(slots.map((v, i) => (i === slot ? null : v)));
  };
  const goNext = () => (isLast ? s.finish() : s.setIndex(s.index + 1));

  const wordClass = "rounded px-1 text-lg font-semibold text-brand-700 dark:text-primary";

  return (
    <PracticeLayout
      type={type}
      position={`${s.index + 1} of ${items.length}`}
      timer={<CountdownTimer key={s.resetKey} totalSeconds={type.timeLimitSeconds} stopped={s.finished} />}
      sidebar={
        <>
          <QuestionNavigation items={items.map((i) => ({ id: i.id, status: s.statusOf(i.id) }))} current={s.index} onSelect={s.setIndex} />
          <SampleSetCard type={type} sampleCount={sampleCount} />
        </>
      }
      banner={s.finished && <ResultsPanel type={type} correct={s.summary.correct} total={s.summary.total} answered={s.summary.answered} onRetry={s.reset} />}
      footer={
        <PracticeFooter
          left={
            <Button variant="secondary" size="lg" leftIcon={<ArrowLeft className="size-4" />} disabled={s.index === 0} onClick={() => s.setIndex(s.index - 1)}>
              Previous
            </Button>
          }
          right={
            !s.finished &&
            (!revealed ? (
              <>
                <Button variant="secondary" size="lg" leftIcon={<SkipForward className="size-4" />} onClick={goNext}>
                  Skip
                </Button>
                <Button size="lg" rightIcon={<Check className="size-4" />} disabled={!complete} onClick={() => s.check(item.id)} title={!complete ? "Fill every blank first" : undefined}>
                  Check
                </Button>
              </>
            ) : (
              <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={goNext}>
                {isLast ? "See Results" : "Continue"}
              </Button>
            ))
          }
        />
      }
    >
      <div className="rounded-xl border border-line p-4 sm:p-6">
        <p className="mb-6 text-base font-semibold text-ink">Make an appropriate sentence.</p>

        <div className="flex items-end gap-3 sm:gap-4">
          <Image src={ILLUSTRATIONS.speakerA.src} alt="First speaker" width={72} height={72} className="size-14 shrink-0 rounded-full ring-2 ring-listening/50 sm:size-[72px]" />
          <p className="pb-1 text-base text-ink sm:text-lg">{item.context}</p>
        </div>

        <div className="mt-8 flex items-end gap-3 sm:gap-4">
          <Image src={ILLUSTRATIONS.speakerB.src} alt="Second speaker (your reply)" width={72} height={72} className="size-14 shrink-0 self-start rounded-full ring-2 ring-listening/50 sm:size-[72px]" />
          <div className="min-w-0 flex-1 pb-1" aria-label="Your sentence">
            <ol className="flex flex-wrap items-end gap-x-3 gap-y-4">
              {item.prefix && <li className="pb-1 text-lg text-ink">{item.prefix}</li>}
              {slots.map((token, i) => {
                const correctHere = token === i;
                return (
                  <li
                    key={i}
                    onDragOver={(e) => !revealed && e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragToken !== null) place(dragToken, i);
                      setDragToken(null);
                    }}
                    className="flex items-end gap-1.5"
                  >
                    {token === null ? (
                      <span
                        className={cn("block h-8 w-16 border-b-2 sm:w-20", revealed ? "border-danger" : "border-ink")}
                        aria-label={`Blank ${i + 1} of ${slots.length}, empty`}
                        role="img"
                      />
                    ) : revealed ? (
                      <>
                        <span
                          className={cn(
                            "border-b-[3px] px-1 pb-0.5 text-lg font-semibold",
                            correctHere ? "border-success text-success" : "border-danger text-ink line-through decoration-2",
                          )}
                        >
                          <span className="sr-only">{correctHere ? "Correct: " : "Your word: "}</span>
                          {item.tokens[token]}
                        </span>
                        {!correctHere && (
                          <span className="pb-1 text-lg font-semibold text-success">
                            <span className="sr-only">Correct word: </span>
                            {item.tokens[i]}
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDragToken(token)}
                        onClick={() => clearSlot(i)}
                        aria-label={`Blank ${i + 1}: ${item.tokens[token]}. Click to remove.`}
                        className={cn(wordClass, "border-b-2 border-ink pb-0.5 hover:border-danger hover:text-danger")}
                      >
                        {item.tokens[token]}
                      </button>
                    )}
                  </li>
                );
              })}
              {item.suffix && <li className="pb-1 text-lg text-ink">{item.suffix}</li>}
            </ol>
          </div>
        </div>

        {!revealed && (
          <div
            className="mt-10 sm:pl-[88px]"
            role="group"
            aria-label="Word bank"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragToken !== null) setSlots(slots.map((v) => (v === dragToken ? null : v)));
              setDragToken(null);
            }}
          >
            <p className="sr-only">Choose the words in order. Each word fills the next blank.</p>
            <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2">
              {bank.length === 0 ? (
                <span className="text-sm text-muted">All words placed. Click a word in the sentence to move it back.</span>
              ) : (
                bank.map((t) => (
                  <button
                    key={t}
                    type="button"
                    draggable
                    onDragStart={() => setDragToken(t)}
                    onClick={() => place(t)}
                    className={cn(wordClass, "hover:underline")}
                  >
                    {item.tokens[t]}
                  </button>
                ))
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-4 -ml-3" leftIcon={<RotateCcw className="size-4" />} disabled={slots.every((v) => v === null)} onClick={() => setSlots(slots.map(() => null))}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {revealed && (
        <section aria-label="Answer feedback" className="flex flex-col gap-4" role="status">
          <div className={cn("flex flex-wrap items-center justify-center gap-3 rounded-xl border p-4 text-center", status === "correct" ? "border-success/40 bg-success-soft" : "border-danger/30 bg-danger-soft")}>
            {status === "correct" ? <CheckCircle2 className="size-8 text-success" aria-hidden /> : <XCircle className="size-8 text-danger" aria-hidden />}
            <p className="text-xl font-bold text-ink">{status === "correct" ? "Your answer was correct!" : "Your answer was incorrect!"}</p>
            {!s.finished && status !== "correct" && (
              <button type="button" onClick={() => setSlots(slots.map(() => null))} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                <RotateCcw className="size-4" aria-hidden /> Try again
              </button>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface-soft p-4 sm:p-5">
            <p className="text-sm font-semibold text-muted">Correct sentence</p>
            <p className="mt-1 text-lg font-medium text-ink">{item.answer}</p>
            <p className="mt-4 flex items-center gap-2 font-bold text-ink">
              <Lightbulb className="size-5 text-warning" aria-hidden /> Why this order?
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {item.parts.map((p, i) => (
                <li key={i} className={cn("rounded-lg px-3 py-2", ROLE_STYLE[p.role].className)}>
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">{ROLE_STYLE[p.role].label}</span>
                  <span className="text-base font-semibold">{p.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-body">{item.explanation}</p>
          </div>
        </section>
      )}
    </PracticeLayout>
  );
}
