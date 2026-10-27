"use client";

import { useCallback, useMemo } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { CompleteWordsSet } from "@/lib/services/types";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { CountdownTimer } from "../CountdownTimer";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { SampleSetCard } from "../SampleSetCard";
import { usePracticeSession } from "../usePracticeSession";
import { cn } from "@/lib/utils/cn";

type Segment = { kind: "text"; text: string } | { kind: "blank"; id: string; prefix: string; missing: string };

export function parseCompleteWords(passageId: string, text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /(\S*?)\[([^\]]+)\]/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ kind: "text", text: text.slice(last, start) });
    segments.push({ kind: "blank", id: `${passageId}:${n++}`, prefix: m[1], missing: m[2] });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

export function CompleteWordsPractice({ type, content, sampleCount }: { type: PracticeType; content: CompleteWordsSet; sampleCount: number }) {
  const passages = useMemo(() => content.items.map((p) => ({ ...p, segments: parseCompleteWords(p.id, p.text) })), [content]);
  const blanks = useMemo(
    () => new Map(passages.flatMap((p) => p.segments.filter((s) => s.kind === "blank").map((s) => [s.id, s as Extract<Segment, { kind: "blank" }>]))),
    [passages],
  );
  const unitIds = useMemo(() => [...blanks.keys()], [blanks]);
  const grade = useCallback((id: string, value: unknown) => String(value ?? "").trim().toLowerCase() === blanks.get(id)?.missing.toLowerCase(), [blanks]);
  const toProgressIds = useCallback((ids: string[]) => [...new Set(ids.map((id) => id.split(":")[0]))], []);
  const s = usePracticeSession<string>({ slug: type.slug, unitIds, grade, toProgressIds });

  const passage = passages[s.index];
  const passageBlankIds = passage.segments.filter((x) => x.kind === "blank").map((x) => (x as { id: string }).id);
  const passageChecked = passageBlankIds.every((id) => s.checked[id]);
  const passageCorrect = passageBlankIds.filter((id) => s.statusOf(id) === "correct").length;
  const filled = passageBlankIds.filter((id) => (s.answers[id] ?? "").length > 0).length;
  const isLast = s.index === passages.length - 1;

  const navItems = passages.map((p) => {
    const ids = p.segments.filter((x) => x.kind === "blank").map((x) => (x as { id: string }).id);
    const statuses = ids.map((id) => s.statusOf(id));
    const status = statuses.every((st) => st === "unanswered")
      ? "unanswered"
      : statuses.every((st) => st === "correct")
        ? "correct"
        : statuses.some((st) => st === "incorrect")
          ? "incorrect"
          : "answered";
    return { id: p.id, status, flagged: s.flagged[p.id] } as const;
  });

  return (
    <PracticeLayout
      type={type}
      position={`Passage ${s.index + 1} of ${passages.length}`}
      timer={<CountdownTimer key={s.resetKey} totalSeconds={type.timeLimitSeconds} stopped={s.finished} />}
      sidebar={
        <>
          <section aria-label="Passage progress" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
            <h2 className="mb-3 text-base font-bold text-ink">Progress</h2>
            <div className="flex items-center gap-5">
              <ProgressRing value={filled} max={passageBlankIds.length} size={96} label={`${filled} of ${passageBlankIds.length} blanks filled`}>
                <span className="text-xl font-bold text-ink tabular-nums">
                  {filled}/{passageBlankIds.length}
                </span>
              </ProgressRing>
              <dl className="flex-1 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Filled</dt>
                  <dd className="font-semibold text-ink">{filled}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Remaining</dt>
                  <dd className="font-semibold text-ink">{passageBlankIds.length - filled}</dd>
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
          <SampleSetCard type={type} sampleCount={sampleCount} />
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
              <Button variant="secondary" size="lg" leftIcon={<RotateCcw className="size-4" />} onClick={() => s.resetUnits(passageBlankIds)} disabled={s.finished}>
                Reset
              </Button>
              {!passageChecked && !s.finished ? (
                <Button size="lg" rightIcon={<Check className="size-4" />} onClick={() => s.check(passageBlankIds)}>
                  Check Answers
                </Button>
              ) : isLast ? (
                !s.finished && (
                  <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={s.finish}>
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
      <article aria-label={passage.title} className="rounded-xl border border-line p-4 text-[17px] leading-[2.6] text-body sm:p-6">
        <h2 className="sr-only">{passage.title}</h2>
        {passage.segments.map((seg, i) => {
          if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
          const value = s.answers[seg.id] ?? "";
          const status = s.statusOf(seg.id);
          const revealed = s.checked[seg.id];
          return (
            <span key={seg.id} className="inline-flex items-baseline">
              <span>{seg.prefix}</span>
              <span className="relative mx-0.5 inline-flex items-center">
                <input
                  value={value}
                  onChange={(e) => s.answer(seg.id, e.target.value.replace(/\s/g, "") || undefined)}
                  maxLength={seg.missing.length}
                  aria-label={`Missing letters for the word starting with “${seg.prefix}”, ${seg.missing.length} letters`}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={s.finished}
                  style={{ width: `calc(${seg.missing.length}ch + 3.25rem)` }}
                  className={cn(
                    "h-10 rounded-lg border bg-surface pl-2 pr-10 font-mono text-base leading-none tracking-[0.15em] text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20",
                    status === "correct" && "border-success bg-success-soft",
                    status === "incorrect" && "border-danger bg-danger-soft",
                    (status === "answered" || status === "unanswered") && "border-line-strong",
                  )}
                />
                <span className="pointer-events-none absolute right-2 text-[11px] font-semibold text-muted tabular-nums" aria-hidden>
                  {value.length}/{seg.missing.length}
                </span>
              </span>
              {revealed && status !== "correct" && (
                <span className="ml-1 rounded bg-success-soft px-1 text-sm font-semibold leading-6 text-success">
                  {seg.prefix}
                  {seg.missing}
                </span>
              )}
            </span>
          );
        })}
      </article>
      {passageChecked && !s.finished && (
        <p className="rounded-xl bg-surface-muted p-3 text-sm text-body" role="status">
          You got <span className="font-bold text-ink">{passageCorrect}</span> of {passageBlankIds.length} words right. Correct words are shown in green.
        </p>
      )}
    </PracticeLayout>
  );
}
