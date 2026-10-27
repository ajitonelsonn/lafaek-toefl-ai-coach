"use client";

import { useMemo, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { CtwSegment, PracticeView } from "@/lib/practice/dto";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { CountdownTimer } from "../CountdownTimer";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { unitKey, usePracticeSession, type UnitStatus } from "../usePracticeSession";
import { LetterBoxes } from "../LetterBoxes";

type CtwView = Extract<PracticeView, { kind: "complete-the-words" }>;
type Blank = Extract<CtwSegment, { type: "blank" }>;

export function CompleteWordsPractice({ type, view, sidebarExtra }: { type: PracticeType; view: CtwView; sidebarExtra: ReactNode }) {
  const passages = view.items;
  const unitKeys = useMemo(() => passages.flatMap((p) => p.segments.filter((x): x is Blank => x.type === "blank").map((b) => unitKey(p.itemId, b.unitId))), [passages]);
  const s = usePracticeSession<string>({ unitKeys });

  const passage = passages[s.index];
  const blankKeys = passage.segments.filter((x): x is Blank => x.type === "blank").map((b) => unitKey(passage.itemId, b.unitId));
  const passageChecked = blankKeys.every((k) => k in s.results);
  const passageCorrect = blankKeys.filter((k) => s.statusOf(k) === "correct").length;
  const filled = blankKeys.filter((k) => (s.answers[k] ?? "").trim().length > 0).length;
  const isLast = s.index === passages.length - 1;

  const navItems = passages.map((p) => {
    const keys = p.segments.filter((x): x is Blank => x.type === "blank").map((b) => unitKey(p.itemId, b.unitId));
    const statuses = keys.map((k) => s.statusOf(k));
    const status: UnitStatus = statuses.every((st) => st === "unanswered")
      ? "unanswered"
      : statuses.every((st) => st === "correct")
        ? "correct"
        : statuses.some((st) => st === "incorrect")
          ? "incorrect"
          : "answered";
    return { id: p.itemId, status };
  });

  return (
    <PracticeLayout
      type={type}
      source={passage.source}
      position={`Passage ${s.index + 1} of ${passages.length}`}
      timer={<CountdownTimer key={s.resetKey} totalSeconds={type.timeLimitSeconds} stopped={s.finished} />}
      sidebar={
        <>
          <section aria-label="Passage progress" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-3 text-base font-bold text-ink">Progress</h2>
            <div className="flex items-center gap-5">
              <ProgressRing value={filled} max={blankKeys.length} size={96} label={`${filled} of ${blankKeys.length} blanks filled`}>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {filled}/{blankKeys.length}
                </span>
              </ProgressRing>
              <dl className="flex-1 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Filled</dt>
                  <dd className="font-semibold text-ink">{filled}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Remaining</dt>
                  <dd className="font-semibold text-ink">{blankKeys.length - filled}</dd>
                </div>
                {passageChecked && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Correct</dt>
                    <dd className="font-semibold text-success">{passageCorrect}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>
          {passages.length > 1 && <QuestionNavigation title="Passages" items={navItems} current={s.index} onSelect={s.setIndex} />}
          {sidebarExtra}
        </>
      }
      banner={s.finished && <ResultsPanel type={type} correct={s.summary.correct} total={s.summary.total} answered={s.summary.answered} onRetry={s.reset} note="Score counts each missing word." />}
      footer={
        <PracticeFooter
          left={
            <Button variant="secondary" size="lg" leftIcon={<ArrowLeft className="size-4" />} disabled={s.index === 0} onClick={() => s.setIndex(s.index - 1)}>
              Previous
            </Button>
          }
          right={
            <>
              <Button variant="secondary" size="lg" leftIcon={<RotateCcw className="size-4" />} onClick={() => s.resetUnits(blankKeys)} disabled={s.finished}>
                Reset
              </Button>
              {!passageChecked && !s.finished ? (
                <Button size="lg" rightIcon={<Check className="size-4" />} disabled={filled === 0} loading={s.pending} onClick={() => void s.check(blankKeys, "")}>
                  Check Answers
                </Button>
              ) : isLast ? (
                !s.finished && (
                  <Button size="lg" rightIcon={<ArrowRight className="size-4" />} loading={s.pending} onClick={() => void s.finish()}>
                    See Results
                  </Button>
                )
              ) : (
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => s.setIndex(s.index + 1)}>
                  Next Passage
                </Button>
              )}
            </>
          }
        />
      }
    >
      <article aria-label={passage.title} className="rounded-xl border border-line p-4 text-[17px] leading-[3.2] text-body sm:p-6">
        <h2 className="sr-only">{passage.title}</h2>
        {passage.segments.map((seg, i) => {
          if (seg.type === "text") return <span key={i}>{seg.text}</span>;
          const key = unitKey(passage.itemId, seg.unitId);
          const value = s.answers[key] ?? "";
          const status = s.statusOf(key);
          const result = s.results[key];
          return (
            <span key={key} className="inline-flex items-baseline">
              <span>{seg.prefix}</span>
              <LetterBoxes
                length={seg.length}
                value={value}
                onChange={(v) => s.answer(key, v.trim() ? v : undefined)}
                label={`Missing letters for the word starting with “${seg.prefix}”`}
                status={status}
                disabled={s.finished}
              />
              {result && result.correct === false && typeof result.answer === "string" && (
                <span className="ml-1 rounded bg-success-soft px-1 text-sm font-semibold leading-6 text-success">
                  {seg.prefix}
                  {result.answer}
                </span>
              )}
            </span>
          );
        })}
      </article>
      {passageChecked && !s.finished && (
        <p className="rounded-xl bg-surface-muted p-3 text-sm text-body" role="status">
          You got <span className="font-bold text-ink">{passageCorrect}</span> of {blankKeys.length} words right. Correct words are shown in green.
        </p>
      )}
    </PracticeLayout>
  );
}
