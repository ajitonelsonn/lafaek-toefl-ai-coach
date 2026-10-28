"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, Loader2, Mic, SkipForward, Sparkles, UserRound, Volume2 } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { AudioDTO, PracticeView, UnitResultDTO } from "@/lib/practice/dto";
import { BACKGROUNDS, ILLUSTRATIONS } from "@/lib/config/assets";
import { api, errorMessage } from "@/lib/client/api";
import { toWav16k } from "@/lib/client/wav";
import { useSession } from "@/components/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { AudioPlayer } from "../AudioPlayer";
import { RecordingControl, type RecordingResult } from "../RecordingControl";
import { unitKey, usePracticeSession } from "../usePracticeSession";
import { ItemImage } from "./ListeningPractice";
import { AiFeedbackPanel, type AiFeedback } from "./AiFeedbackPanel";

type SpeakingView = Extract<PracticeView, { kind: "listen-repeat" | "take-interview" }>;

interface Unit {
  key: string;
  itemId: string;
  unitId: string;
  source: "starter" | "generated";
  audio: AudioDTO;
  responseSeconds: number;
  context: string;
  imageAssetId: string | null;
  illustration: "officePrinter" | null;
}

export function SpeakingPractice({ type, view, sidebarExtra }: { type: PracticeType; view: SpeakingView; sidebarExtra: ReactNode }) {
  const isInterview = view.kind === "take-interview";
  const { settings } = useSession();
  const toast = useToast();
  const units: Unit[] = useMemo(
    () =>
      view.kind === "listen-repeat"
        ? view.items.flatMap((i) => i.sentences.map((x) => ({ key: unitKey(i.itemId, x.unitId), itemId: i.itemId, unitId: x.unitId, source: i.source, audio: x.audio, responseSeconds: x.responseSeconds, context: i.situation, imageAssetId: i.imageAssetId, illustration: i.illustration })))
        : view.items.flatMap((i) => i.questions.map((x) => ({ key: unitKey(i.itemId, x.unitId), itemId: i.itemId, unitId: x.unitId, source: i.source, audio: x.audio, responseSeconds: x.responseSeconds, context: i.scenario, imageAssetId: i.imageAssetId, illustration: null }))),
    [view],
  );
  const s = usePracticeSession<string>({ unitKeys: units.map((u) => u.key), gradable: false });
  const [heard, setHeard] = useState<Record<string, boolean>>({});
  const [transcribing, setTranscribing] = useState(false);
  const [coaching, setCoaching] = useState<Record<string, { feedback: AiFeedback; label: string }>>({});
  const [coachBusy, setCoachBusy] = useState(false);

  const unit = units[s.index];
  const answered = unit.key in s.answers || unit.key in s.results;
  const result: UnitResultDTO | undefined = s.results[unit.key];
  const listened = !!heard[unit.key];
  const isLast = s.index === units.length - 1;
  const next = () => (isLast ? void s.finish() : s.setIndex(s.index + 1));
  const itemUnits = units.filter((u) => u.itemId === unit.itemId);
  const unitNumberInItem = itemUnits.findIndex((u) => u.key === unit.key) + 1;

  const reset = () => {
    setHeard({});
    setCoaching({});
    s.reset();
  };

  const onRecorded = async (r: RecordingResult) => {
    if (r.simulated || !r.blob) {
      s.answer(unit.key, "timer-only");
      return;
    }
    s.answer(unit.key, "recorded");
    setTranscribing(true);
    try {
      const wav = await toWav16k(r.blob);
      const form = new FormData();
      form.append("unitId", unit.unitId);
      form.append("audio", wav, "response.wav");
      form.append("keepRecording", String(settings.recordingConsent));
      const res = await api<{ results: Record<string, UnitResultDTO> }>(`/api/practice/items/${unit.itemId}/speaking`, { form });
      s.addResults(Object.fromEntries(Object.entries(res.results).map(([u, v]) => [unitKey(unit.itemId, u), v])));
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setTranscribing(false);
    }
  };

  const coach = async () => {
    if (!result?.transcript) return;
    setCoachBusy(true);
    try {
      const r = await api<{ feedback: AiFeedback; label: string }>(`/api/practice/items/${unit.itemId}/feedback`, { body: { unitId: unit.unitId, text: result.transcript } });
      setCoaching((c) => ({ ...c, [unit.key]: r }));
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setCoachBusy(false);
    }
  };

  const recorder = (
    <div className="rounded-xl bg-speaking-soft/60 p-4 text-center">
      <p className="mb-3 text-sm text-body">
        <Mic className="mr-1.5 inline size-4 align-[-3px] text-speaking" aria-hidden />
        <span>
          You have <span className="font-bold text-ink">{unit.responseSeconds} seconds</span> to record your response.
        </span>
      </p>
      <RecordingControl
        key={`${unit.key}-${s.resetKey}`}
        maxSeconds={unit.responseSeconds}
        disabled={!listened || s.finished}
        disabledReason={s.finished ? "Practice finished." : "Listen to the audio first."}
        onRecorded={(r) => void onRecorded(r)}
        onCleared={() => s.answer(unit.key, undefined)}
      />
      {!listened && !s.finished && (
        <button type="button" onClick={() => setHeard((h) => ({ ...h, [unit.key]: true }))} className="mt-3 text-xs font-semibold text-primary hover:underline">
          Audio not working? Record without listening
        </button>
      )}
      {transcribing && (
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Transcribing your answer…
        </p>
      )}
      {result?.transcript !== undefined && (
        <div className="mt-4 rounded-lg bg-surface p-3 text-left text-sm" role="status">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">What we heard</p>
          <p className="mt-1 text-ink">{result.transcript || "(No speech was detected.)"}</p>
          {typeof result.similarity === "number" && (
            <p className="mt-2 text-body">
              Match with the sentence: <span className="font-bold text-ink">{Math.round(result.similarity * 100)}%</span>
            </p>
          )}
          {typeof result.answer === "string" && (
            <p className="mt-1 text-body">
              <span className="font-semibold text-ink">Sentence: </span>
              {result.answer}
            </p>
          )}
          {result.explanation && <p className="mt-1 text-body">{result.explanation}</p>}
          <p className="mt-2 text-xs text-muted">{result.label}</p>
          {isInterview && result.transcript && !coaching[unit.key] && (
            <Button className="mt-3" size="sm" variant="soft" leftIcon={<Sparkles className="size-4" />} loading={coachBusy} onClick={() => void coach()}>
              Get AI coaching
            </Button>
          )}
        </div>
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
        key={`${unit.key}-${s.resetKey}`}
        audio={unit.audio}
        compact
        transcript={isInterview}
        onEnded={() => setHeard((h) => ({ ...h, [unit.key]: true }))}
        label={isInterview ? "Play interviewer question" : "Play sentence"}
      />
    </div>
  );

  return (
    <PracticeLayout
      type={type}
      source={unit.source}
      position={`${s.index + 1} of ${units.length}`}
      sidebar={
        <>
          <QuestionNavigation items={units.map((u) => ({ id: u.key, status: s.statusOf(u.key) }))} current={s.index} onSelect={s.setIndex} />
          {sidebarExtra}
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
            note="Speaking feedback is based on an automatic transcript. It is a practice estimate, not an official or pronunciation score."
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
                {!answered && (
                  <Button variant="secondary" size="lg" leftIcon={<SkipForward className="size-4" />} onClick={next}>
                    Skip
                  </Button>
                )}
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} disabled={!answered || transcribing} onClick={next} title={!answered ? "Record your response first" : undefined}>
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
            <p className="text-[15px] text-body">{unit.context}</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <figure className="relative overflow-hidden rounded-xl bg-[#eef4ff]">
              <Image
                src={BACKGROUNDS.interviewer.src}
                alt="The LafaekTOEFL crocodile mascot in a suit, holding a microphone and a clipboard, asking you a question"
                width={BACKGROUNDS.interviewer.width}
                height={BACKGROUNDS.interviewer.height}
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="aspect-[4/3] w-full object-cover object-[center_20%]"
              />
              <figcaption className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-950/80 px-2.5 py-1 text-xs font-semibold text-white">
                <UserRound className="size-3.5" aria-hidden /> Interviewer (mascot)
              </figcaption>
            </figure>
            <div className="flex min-w-0 flex-col gap-4">
              <p className="rounded-2xl bg-surface-muted p-4 text-base text-ink">
                Question {unitNumberInItem} of {itemUnits.length}. Please answer the interviewer&apos;s question.
              </p>
              {audio}
            </div>
          </div>
          {recorder}
          {coaching[unit.key] && <AiFeedbackPanel feedback={coaching[unit.key].feedback} label={coaching[unit.key].label} />}
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <div className="flex items-center justify-center rounded-xl border border-line bg-[#eef6ff] p-4">
            <ItemImage
              assetId={unit.imageAssetId}
              alt="Illustration of the situation"
              fallback={
                unit.illustration ? (
                  <Image src={ILLUSTRATIONS.officePrinter.src} alt="Illustration of an office printer and scanner" width={ILLUSTRATIONS.officePrinter.width} height={ILLUSTRATIONS.officePrinter.height} className="h-auto max-h-72 w-auto object-contain" />
                ) : (
                  <Building2 className="size-16 text-primary/60" aria-hidden />
                )
              }
            />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <p className="mb-1 flex items-center gap-2 font-bold text-ink">
                <Building2 className="size-5 text-primary" aria-hidden /> Situation
              </p>
              <p className="text-[15px] text-body">{unit.context}</p>
            </div>
            {audio}
            {recorder}
          </div>
        </div>
      )}
    </PracticeLayout>
  );
}
