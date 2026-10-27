"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, Headphones } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { ChoiceQuestion } from "@/lib/services/types";
import { Button } from "@/components/ui/Button";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { CountdownTimer } from "../CountdownTimer";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { SampleSetCard } from "../SampleSetCard";
import { ChoiceList } from "../ChoiceList";
import { usePracticeSession } from "../usePracticeSession";
import { cn } from "@/lib/utils/cn";

export interface ChoiceGroup {
  id: string;
  title?: string;
  questions: ChoiceQuestion[];
}

interface StimulusHelpers {
  markHeard: () => void;
  heard: boolean;
  resetKey: number;
}

interface ChoiceSetPracticeProps {
  type: PracticeType;
  sampleCount: number;
  groups: ChoiceGroup[];
  stimulus: (group: ChoiceGroup, helpers: StimulusHelpers) => ReactNode;
  /** "split" = stimulus beside the question on large screens; "stacked" = above. */
  layout?: "split" | "stacked";
  /** Hide questions until the audio for the group has finished. */
  listenFirst?: boolean;
}

export function ChoiceSetPractice({ type, sampleCount, groups, stimulus, layout = "split", listenFirst }: ChoiceSetPracticeProps) {
  const questions = useMemo(() => groups.flatMap((g) => g.questions.map((q) => ({ q, groupId: g.id }))), [groups]);
  const unitIds = useMemo(() => questions.map((x) => x.q.id), [questions]);
  const byId = useMemo(() => new Map(questions.map((x) => [x.q.id, x.q])), [questions]);
  const grade = useCallback((id: string, value: unknown) => byId.get(id)?.answerId === value, [byId]);
  const s = usePracticeSession<string>({ slug: type.slug, unitIds, grade });
  const [heard, setHeard] = useState<Record<string, boolean>>({});

  const current = questions[s.index];
  const group = groups.find((g) => g.id === current.groupId)!;
  const qId = current.q.id;
  const revealed = !!s.checked[qId];
  const isLast = s.index === questions.length - 1;
  const groupHeard = !listenFirst || heard[group.id];
  const numberInGroup = group.questions.findIndex((q) => q.id === qId) + 1;

  const reset = () => {
    setHeard({});
    s.reset();
  };

  const primary = !revealed ? (
    <Button size="lg" rightIcon={<Check className="size-4" />} onClick={() => s.check(qId)} disabled={!(qId in s.answers) || !groupHeard}>
      Check Answer
    </Button>
  ) : !isLast ? (
    <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => s.setIndex(s.index + 1)}>
      Next Question
    </Button>
  ) : (
    !s.finished && (
      <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={s.finish}>
        See Results
      </Button>
    )
  );

  const questionArea = groupHeard ? (
    <div className="min-w-0">
      {group.questions.length > 1 && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Question {numberInGroup} of {group.questions.length} for this {listenFirst ? "audio" : "text"}
        </p>
      )}
      <ChoiceList
        key={qId}
        question={current.q}
        number={s.index + 1}
        value={s.answers[qId]}
        onChange={(v) => !revealed && s.answer(qId, v)}
        revealed={revealed}
        size={layout === "stacked" ? "lg" : "md"}
      />
      {!revealed && !(qId in s.answers) && <p className="mt-3 text-sm text-muted">Choose an answer, then select “Check Answer”.</p>}
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
  );

  return (
    <PracticeLayout
      type={type}
      position={`${s.index + 1} of ${questions.length}`}
      timer={<CountdownTimer key={s.resetKey} totalSeconds={type.timeLimitSeconds} stopped={s.finished} />}
      sidebar={
        <>
          <QuestionNavigation
            items={questions.map((x) => ({ id: x.q.id, status: s.statusOf(x.q.id), flagged: s.flagged[x.q.id] }))}
            current={s.index}
            onSelect={s.setIndex}
          />
          <SampleSetCard type={type} sampleCount={sampleCount} />
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
                aria-pressed={!!s.flagged[qId]}
                leftIcon={s.flagged[qId] ? <BookmarkCheck className="size-4 text-warning" /> : <Bookmark className="size-4" />}
                onClick={() => s.toggleFlag(qId)}
              >
                {s.flagged[qId] ? "Marked for Review" : "Mark for Review"}
              </Button>
              {primary}
            </>
          }
        />
      }
    >
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", layout === "split" && "lg:grid-cols-2")}>
        <div className="min-w-0">{stimulus(group, { markHeard: () => setHeard((h) => ({ ...h, [group.id]: true })), heard: !!heard[group.id], resetKey: s.resetKey })}</div>
        {questionArea}
      </div>
    </PracticeLayout>
  );
}
