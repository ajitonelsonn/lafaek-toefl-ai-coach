"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, Headphones } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { ChoiceQuestionDTO, UnitResultDTO } from "@/lib/practice/dto";
import { Button } from "@/components/ui/Button";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { ChoiceList } from "../ChoiceList";
import { unitKey, usePracticeSession } from "../usePracticeSession";
import { cn } from "@/lib/utils/cn";

export interface ChoiceGroup {
  id: string;
  title?: string;
  source: "starter" | "generated";
  questions: ChoiceQuestionDTO[];
}

interface StimulusHelpers {
  markHeard: () => void;
  heard: boolean;
  resetKey: number;
  /** Script revealed by the server after any question of this item was checked. */
  revealedScript: UnitResultDTO["script"] | null;
}

interface ChoiceSetPracticeProps {
  type: PracticeType;
  groups: ChoiceGroup[];
  stimulus: (group: ChoiceGroup, helpers: StimulusHelpers) => ReactNode;
  sidebarExtra: ReactNode;
  layout?: "split" | "stacked";
  /** Hide questions until the audio for the group has finished. */
  listenFirst?: boolean;
}

export function ChoiceSetPractice({ type, groups, stimulus, sidebarExtra, layout = "split", listenFirst }: ChoiceSetPracticeProps) {
  const questions = useMemo(() => groups.flatMap((g) => g.questions.map((q) => ({ q, group: g, key: unitKey(g.id, q.unitId) }))), [groups]);
  const unitKeys = useMemo(() => questions.map((x) => x.key), [questions]);
  const s = usePracticeSession<string>({ unitKeys });
  const [heard, setHeard] = useState<Record<string, boolean>>({});

  const current = questions[s.index];
  const group = current.group;
  const key = current.key;
  const result = s.results[key];
  const isLast = s.index === questions.length - 1;
  const groupHeard = !listenFirst || heard[group.id];
  const numberInGroup = group.questions.findIndex((q) => q.unitId === current.q.unitId) + 1;
  const revealedScript = group.questions.map((q) => s.results[unitKey(group.id, q.unitId)]?.script).find(Boolean) ?? null;

  const reset = () => {
    setHeard({});
    s.reset();
  };

  const primary = !result ? (
    <Button size="lg" rightIcon={<Check className="size-4" />} onClick={() => void s.check(key)} disabled={!(key in s.answers) || !groupHeard} loading={s.pending}>
      Check Answer
    </Button>
  ) : !isLast ? (
    <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => s.setIndex(s.index + 1)}>
      Next Question
    </Button>
  ) : (
    !s.finished && (
      <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => void s.finish()} loading={s.pending}>
        See Results
      </Button>
    )
  );

  return (
    <PracticeLayout
      type={type}
      source={group.source}
      position={`${s.index + 1} of ${questions.length}`}
      sidebar={
        <>
          <QuestionNavigation items={questions.map((x) => ({ id: x.key, status: s.statusOf(x.key), flagged: s.flagged[x.key] }))} current={s.index} onSelect={s.setIndex} />
          {sidebarExtra}
        </>
      }
      banner={s.finished && <ResultsPanel type={type} correct={s.summary.correct} total={s.summary.total} answered={s.summary.answered} onRetry={reset} />}
      footer={
        <PracticeFooter
          left={
            <Button variant="secondary" size="lg" leftIcon={<ArrowLeft className="size-4" />} disabled={s.index === 0} onClick={() => s.setIndex(s.index - 1)}>
              Previous
            </Button>
          }
          right={
            <>
              <Button
                variant="secondary"
                size="lg"
                aria-pressed={!!s.flagged[key]}
                leftIcon={s.flagged[key] ? <BookmarkCheck className="size-4 text-warning" /> : <Bookmark className="size-4" />}
                onClick={() => s.toggleFlag(key)}
              >
                {s.flagged[key] ? "Marked for Review" : "Mark for Review"}
              </Button>
              {primary}
            </>
          }
        />
      }
    >
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", layout === "split" && "lg:grid-cols-2")}>
        <div className="min-w-0">{stimulus(group, { markHeard: () => setHeard((h) => ({ ...h, [group.id]: true })), heard: !!heard[group.id], resetKey: s.resetKey, revealedScript })}</div>
        {groupHeard ? (
          <div className="min-w-0">
            {group.questions.length > 1 && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Question {numberInGroup} of {group.questions.length} for this {listenFirst ? "audio" : "text"}
              </p>
            )}
            <ChoiceList
              key={key}
              question={current.q}
              number={s.index + 1}
              value={s.answers[key]}
              onChange={(v) => !result && s.answer(key, v)}
              result={result}
              size={layout === "stacked" ? "lg" : "md"}
            />
            {!result && !(key in s.answers) && <p className="mt-3 text-sm text-muted">Choose an answer, then select “Check Answer”.</p>}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-soft p-6 text-center">
            <Headphones className="size-8 text-primary" aria-hidden />
            <p className="font-semibold text-ink">Listen to the audio first</p>
            <p className="max-w-xs text-sm text-muted">The questions will appear when the audio finishes, like in the real test.</p>
            <button type="button" onClick={() => setHeard((h) => ({ ...h, [group.id]: true }))} className="text-sm font-semibold text-primary hover:underline">
              Show questions now
            </button>
          </div>
        )}
      </div>
    </PracticeLayout>
  );
}
