"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Mic, SkipForward, UserRound, Volume2 } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { InterviewSet, ListenRepeatSet } from "@/lib/services/types";
import { BACKGROUNDS, ILLUSTRATIONS } from "@/lib/config/assets";
import { Button } from "@/components/ui/Button";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { CountdownTimer } from "../CountdownTimer";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { SampleSetCard } from "../SampleSetCard";
import { AudioPlayer } from "../AudioPlayer";
import { RecordingControl, type RecordingResult } from "../RecordingControl";
import { usePracticeSession } from "../usePracticeSession";

interface SpeakingPracticeProps {
  type: PracticeType;
  content: ListenRepeatSet | InterviewSet;
  sampleCount: number;
}

export function SpeakingPractice({ type, content, sampleCount }: SpeakingPracticeProps) {
  const isInterview = content.kind === "take-interview";
  const items = content.items;
  const unitIds = useMemo(() => items.map((i) => i.id), [items]);
  const grade = useCallback(() => null, []);
  const s = usePracticeSession<RecordingResult>({ slug: type.slug, unitIds, grade, gradable: false });
  const [heard, setHeard] = useState<Record<string, boolean>>({});

  const item = items[s.index];
  const recording = s.answers[item.id];
  const listened = !!heard[item.id];
  const isLast = s.index === items.length - 1;
  const next = () => (isLast ? s.finish() : s.setIndex(s.index + 1));

  const reset = () => {
    setHeard({});
    s.reset();
  };

  const recorder = (
    <div className="rounded-xl bg-speaking-soft/60 p-4 text-center">
      <p className="mb-3 text-sm text-body">
        <Mic className="mr-1.5 inline size-4 align-[-3px] text-speaking" aria-hidden />
        <span>
          You have <span className="font-bold text-ink">{item.responseSeconds} seconds</span> to record your response.
        </span>
      </p>
      <RecordingControl
        key={`${item.id}-${s.resetKey}`}
        maxSeconds={item.responseSeconds}
        disabled={!listened || s.finished}
        disabledReason={s.finished ? "Practice finished." : "Listen to the audio first."}
        onRecorded={(r) => s.answer(item.id, r)}
        onCleared={() => s.answer(item.id, undefined)}
      />
      {!listened && !s.finished && (
        <button type="button" onClick={() => setHeard((h) => ({ ...h, [item.id]: true }))} className="mt-3 text-xs font-semibold text-primary hover:underline">
          Audio not working? Record without listening
        </button>
      )}
    </div>
  );

  const audio = (
    <div className="rounded-xl bg-primary-soft/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Volume2 className="size-4" aria-hidden />
        {isInterview ? "Listen to the interviewer's question." : "Listen and repeat only once."}
      </p>
      <AudioPlayer
        key={`${item.id}-${s.resetKey}`}
        media={item.audio}
        compact
        transcript={isInterview || !!recording}
        onEnded={() => setHeard((h) => ({ ...h, [item.id]: true }))}
        label={isInterview ? "Play interviewer question" : "Play sentence"}
      />
      {!isInterview && recording && <p className="mt-2 text-xs text-muted">Open the transcript to compare your answer with the sentence.</p>}
    </div>
  );

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
      banner={
        s.finished && (
          <ResultsPanel
            type={type}
            correct={null}
            total={s.summary.total}
            answered={s.summary.answered}
            onRetry={reset}
            note="Speaking is not scored in this demo. AI pronunciation and fluency feedback will be added when the AI service is connected."
          />
        )
      }
      footer={
        <PracticeFooter
          left={
            <Button variant="secondary" size="lg" leftIcon={<ArrowLeft className="size-4" />} disabled={s.index === 0} onClick={() => s.setIndex(s.index - 1)}>
              Previous
            </Button>
          }
          right={
            !s.finished && (
              <>
                {isInterview && !recording && (
                  <Button variant="secondary" size="lg" leftIcon={<SkipForward className="size-4" />} onClick={next}>
                    Skip Question
                  </Button>
                )}
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} disabled={!recording} onClick={next} title={!recording ? "Record your response first" : undefined}>
                  {isLast ? "Finish" : "Next Question"}
                </Button>
              </>
            )
          }
        />
      }
    >
      {isInterview ? (
        <>
          <div className="rounded-xl bg-primary-soft/70 p-4">
            <p className="mb-1 font-bold text-ink">Task</p>
            <p className="text-[15px] text-body">{(content as InterviewSet).scenario}</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <figure className="relative overflow-hidden rounded-xl bg-[#eef4ff]">
              <Image
                src={BACKGROUNDS.profile.src}
                alt="The LafaekTOEFL crocodile mascot at a laptop, acting as the interviewer"
                width={BACKGROUNDS.profile.width}
                height={BACKGROUNDS.profile.height}
                className="mx-auto h-64 w-auto object-contain sm:h-72"
              />
              <figcaption className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-950/80 px-2.5 py-1 text-xs font-semibold text-white">
                <UserRound className="size-3.5" aria-hidden /> Interviewer (mascot)
              </figcaption>
            </figure>
            <div className="flex flex-col gap-4">
              <p className="rounded-2xl bg-surface-muted p-4 text-base text-ink">
                Question {s.index + 1} of {items.length}. Please answer the interviewer&apos;s question.
              </p>
              {audio}
            </div>
          </div>
          {recorder}
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <div className="flex items-center justify-center rounded-xl border border-line bg-[#eef6ff] p-4">
            <Image
              src={ILLUSTRATIONS.officePrinter.src}
              alt="Illustration of an office printer and scanner"
              width={ILLUSTRATIONS.officePrinter.width}
              height={ILLUSTRATIONS.officePrinter.height}
              className="h-auto max-h-72 w-auto object-contain"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 flex items-center gap-2 font-bold text-ink">
                <Building2 className="size-5 text-primary" aria-hidden /> Situation
              </p>
              <p className="text-[15px] text-body">{(content as ListenRepeatSet).situation}</p>
            </div>
            {audio}
            {recorder}
          </div>
        </div>
      )}
    </PracticeLayout>
  );
}
