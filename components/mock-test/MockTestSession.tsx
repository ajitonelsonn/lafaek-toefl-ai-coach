"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, Send } from "lucide-react";
import { getSkill, type SkillId } from "@/lib/config/practice-types";
import { MOCK_DEMO_MINUTES, MOCK_PART_MINUTES } from "@/lib/config/mock-test";
import { MockTestSubmitting, type SubmitStage } from "./MockTestSubmitting";
import type { AudioDTO, ChoiceQuestionDTO, CtwSegment, PracticeView } from "@/lib/practice/dto";
import type { DailyLifeDocument } from "@/lib/services/types";
import { api, errorMessage } from "@/lib/client/api";
import { toWav16k } from "@/lib/client/wav";
import { countWords } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { CountdownTimer } from "@/components/practice/CountdownTimer";
import { QuestionNavigation } from "@/components/practice/QuestionNavigation";
import { ChoiceList } from "@/components/practice/ChoiceList";
import { AudioPlayer } from "@/components/practice/AudioPlayer";
import { RecordingControl, type RecordingResult } from "@/components/practice/RecordingControl";
import { SKILL_TONE } from "@/components/practice/icons";
import { LetterBoxes } from "@/components/practice/LetterBoxes";
import { DocumentView } from "@/components/practice/tasks/ReadingPractice";
import { LoadingWave } from "@/components/ui/MediaLoading";
import { cn } from "@/lib/utils/cn";

export interface MockFormItemDTO {
  skill: SkillId;
  slug?: string;
  units: string[];
  view: PracticeView;
}

type UnitBase = { key: string; itemId: string; unitId: string; skill: SkillId; slug: PracticeView["kind"]; title: string };

/** A timed part of the test: a whole section, or one task type with its own timer (Writing). */
interface Part {
  id: string;
  skill: SkillId;
  title: string;
  minutes: number;
  units: Unit[];
}

function toParts(units: Unit[], order: SkillId[]): Part[] {
  return order.flatMap((skill) => {
    const mine = units.filter((u) => u.skill === skill);
    const slugs = [...new Set(mine.map((u) => u.slug))];
    if (!slugs.some((slug) => MOCK_PART_MINUTES[slug])) return [{ id: skill, skill, title: getSkill(skill).title, minutes: MOCK_DEMO_MINUTES[skill], units: mine }];
    return slugs.map((slug) => ({ id: `${skill}:${slug}`, skill, title: TITLES[slug], minutes: MOCK_PART_MINUTES[slug] ?? MOCK_DEMO_MINUTES[skill], units: mine.filter((u) => u.slug === slug) }));
  });
}
type Unit = UnitBase &
  (
    | { kind: "choice"; question: ChoiceQuestionDTO; document?: DailyLifeDocument; passage?: { title: string; paragraphs: string[] }; audio?: AudioDTO }
    /** A whole Complete the Words passage on one screen; the answer maps each blank to its letters. */
    | { kind: "ctw"; passageTitle: string; segments: CtwSegment[]; blanks: string[] }
    | { kind: "build"; context: string; prefix: string | null; suffix: string | null; tokens: { id: string; text: string }[] }
    | { kind: "writing"; scenario: string; bullets: string[]; recipient: string | null; subject: string | null; professor: { name: string; prompt: string } | null; students: { name: string; text: string }[] }
    | { kind: "speaking"; intro: string; repeat: boolean; audio: AudioDTO; responseSeconds: number }
  );

const TITLES: Record<PracticeView["kind"], string> = {
  "complete-the-words": "Complete the Words",
  "read-in-daily-life": "Read in Daily Life",
  "read-academic-passage": "Read an Academic Passage",
  "listen-choose-response": "Listen and Choose a Response",
  "listen-conversation": "Listen to a Conversation",
  "listen-announcement": "Listen to an Announcement",
  "listen-academic-talk": "Listen to an Academic Talk",
  "build-sentence": "Build a Sentence",
  "write-email": "Write an Email",
  "academic-discussion": "Write for an Academic Discussion",
  "listen-repeat": "Listen and Repeat",
  "take-interview": "Take an Interview",
};

/** Flattens server form items into the units the session walks through. */
function toUnits(form: MockFormItemDTO[]): Unit[] {
  const out: Unit[] = [];
  for (const f of form) {
    const v = f.view;
    const title = TITLES[v.kind];
    const key = (itemId: string, unitId: string) => `${itemId}:${unitId}`;
    switch (v.kind) {
      case "read-in-daily-life":
      case "read-academic-passage":
        for (const it of v.items)
          for (const q of it.questions.filter((q) => f.units.includes(q.unitId)))
            out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, slug: v.kind, kind: "choice", title, question: q, document: it.document, passage: it.paragraphs ? { title: it.title, paragraphs: it.paragraphs } : undefined });
        break;
      case "listen-choose-response":
        for (const it of v.items) out.push({ key: key(it.itemId, it.question.unitId), itemId: it.itemId, unitId: it.question.unitId, skill: f.skill, slug: v.kind, kind: "choice", title, question: it.question, audio: it.audio });
        break;
      case "listen-conversation":
      case "listen-announcement":
      case "listen-academic-talk":
        for (const it of v.items)
          for (const q of it.questions.filter((q) => f.units.includes(q.unitId))) out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, slug: v.kind, kind: "choice", title, question: q, audio: it.audio });
        break;
      case "complete-the-words":
        for (const it of v.items) {
          const blanks = it.segments.flatMap((sg) => (sg.type === "blank" && f.units.includes(sg.unitId) ? [sg.unitId] : []));
          out.push({ key: key(it.itemId, "ctw"), itemId: it.itemId, unitId: "ctw", skill: f.skill, slug: v.kind, kind: "ctw", title, passageTitle: it.title, segments: it.segments, blanks });
        }
        break;
      case "build-sentence":
        for (const it of v.items) out.push({ key: key(it.itemId, it.unitId), itemId: it.itemId, unitId: it.unitId, skill: f.skill, slug: v.kind, kind: "build", title, context: it.context, prefix: it.prefix, suffix: it.suffix, tokens: it.tokens });
        break;
      case "write-email":
      case "academic-discussion":
        for (const it of v.items)
          out.push({ key: key(it.itemId, it.unitId), itemId: it.itemId, unitId: it.unitId, skill: f.skill, slug: v.kind, kind: "writing", title, scenario: it.scenario, bullets: it.bullets, recipient: it.recipient, subject: it.subject, professor: it.professor, students: it.students });
        break;
      case "listen-repeat":
        for (const it of v.items)
          for (const q of it.sentences.filter((q) => f.units.includes(q.unitId)))
            out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, slug: v.kind, kind: "speaking", title, intro: it.situation, repeat: true, audio: q.audio, responseSeconds: q.responseSeconds });
        break;
      case "take-interview":
        for (const it of v.items)
          for (const q of it.questions.filter((q) => f.units.includes(q.unitId)))
            out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, slug: v.kind, kind: "speaking", title, intro: it.scenario, repeat: false, audio: q.audio, responseSeconds: q.responseSeconds });
        break;
      default:
        break;
    }
  }
  return out;
}

export function MockTestSession({ form, token, sections }: { form: MockFormItemDTO[]; token: string; sections: SkillId[] }) {
  const router = useRouter();
  const toast = useToast();
  const units = useMemo(() => toUnits(form), [form]);
  // One timed part at a time (a section, or a Writing task), like the real test. Finished parts are closed.
  const order = useMemo(() => sections.filter((s) => units.some((u) => u.skill === s)), [sections, units]);
  const parts = useMemo(() => toParts(units, order), [units, order]);

  const [partIdx, setPartIdx] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<SubmitStage>(0);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);
  // Speaking answers upload as soon as they are recorded; submit waits for any still uploading.
  const uploads = useRef(new Map<string, Promise<void>>());
  const [uploadState, setUploadState] = useState<Record<string, UploadState>>({});
  // Each audio plays once in the whole test, also when several questions share it.
  const [played, setPlayed] = useState<Record<string, boolean>>({});
  // Listening questions appear only after their audio has been heard to the end, like the real test.
  const [heard, setHeard] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!submitted.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (!units.length) {
    return (
      <EmptyState
        title="No questions in this test"
        description="Go back and choose at least one section."
        action={
          <Link href="/mock-test" className="font-semibold text-primary">
            Back to Mock Test
          </Link>
        }
      />
    );
  }

  const part = parts[partIdx];
  const section = part.skill;
  const sectionIdx = order.indexOf(section);
  const sectionUnits = part.units;
  const unit = sectionUnits[Math.min(index, sectionUnits.length - 1)];
  const isLastSection = partIdx === parts.length - 1;
  const nextPart = parts[partIdx + 1];
  const nextIsNewSection = !!nextPart && nextPart.skill !== section;
  const isAnswered = (u: Unit) => {
    const a = answers[u.key];
    if (a === undefined) return false;
    if (u.kind === "writing") return typeof (a as { body?: string }).body === "string" && (a as { body: string }).body.trim().length > 0;
    if (u.kind === "ctw") return Object.values(a as Record<string, string>).some((v) => v.trim());
    if (u.kind === "build") return (a as (string | null)[]).some((v) => v !== null);
    return true;
  };
  const unansweredHere = sectionUnits.filter((u) => !isAnswered(u)).length;
  const personalised = form.filter((f) => f.view.items[0]?.source === "generated").length;
  const setAnswer = (key: string, value: unknown) =>
    setAnswers((a) => {
      const next = { ...a };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  const set = (value: unknown) => setAnswer(unit.key, value);

  const recordSpeaking = (u: Unit, r: RecordingResult) => {
    // Without a microphone nothing was captured: the question counts as unanswered.
    if (r.simulated || !r.blob) {
      toast("No recording was captured, so this answer cannot be rated.", "warning");
      return;
    }
    const blob = r.blob;
    setAnswer(u.key, "recorded");
    setUploadState((s) => ({ ...s, [u.key]: "uploading" }));
    const upload = (async () => {
      try {
        const form = new FormData();
        form.append("token", token);
        form.append("itemId", u.itemId);
        form.append("unitId", u.unitId);
        form.append("audio", await toWav16k(blob), "answer.wav");
        await api("/api/mock-test/recording", { form });
        setUploadState((s) => ({ ...s, [u.key]: "saved" }));
      } catch (e) {
        setAnswer(u.key, undefined);
        setUploadState((s) => ({ ...s, [u.key]: "failed" }));
        toast(`${errorMessage(e)} Please record this answer again.`, "warning");
      }
    })();
    uploads.current.set(u.key, upload);
  };

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setStage(0);
    let scoring: number | undefined;
    try {
      await Promise.all(uploads.current.values());
      setStage(1);
      // Speaking recordings are already uploaded; the answer only marks them as given.
      const payload = units
        .filter((u) => isAnswered(u))
        .flatMap((u) => {
          // A passage screen sends one answer per blank.
          if (u.kind === "ctw") return Object.entries(answers[u.key] as Record<string, string>).filter(([, v]) => v.trim()).map(([unitId, v]) => ({ itemId: u.itemId, unitId, response: v }));
          return [{ itemId: u.itemId, unitId: u.unitId, response: u.kind === "speaking" ? null : answers[u.key] }];
        });
      // The server scores Reading and Listening while the request runs.
      scoring = window.setTimeout(() => setStage(2), 700);
      await api("/api/mock-test/submit", { body: { token, durationSeconds: Math.round((Date.now() - startedAt.current) / 1000), answers: payload } });
      window.clearTimeout(scoring);
      setStage(3);
      await new Promise((r) => setTimeout(r, 700));
      setStage(4);
      await new Promise((r) => setTimeout(r, 900));
      router.push("/mock-test/results");
      router.refresh();
    } catch (e) {
      window.clearTimeout(scoring);
      submitted.current = false;
      toast(errorMessage(e), "warning");
      setSubmitting(false);
      setConfirm(false);
    }
  };

  /** Ends the current part (early by choice, or when its time is up) and opens the next one. */
  const endSection = (timeUp: boolean) => {
    setConfirm(false);
    if (isLastSection) {
      if (timeUp) toast("Time is up. Submitting your test.", "info");
      void submit();
      return;
    }
    toast(timeUp ? `Time is up for ${part.title}. Starting ${nextPart.title}.` : `Starting ${nextPart.title}.`, "info");
    setPartIdx((i) => i + 1);
    setIndex(0);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Mock Test</h1>
          <StatusBadge tone={personalised ? "primary" : "warning"}>{personalised ? "Practice test · from your personalised questions" : "Practice test · starter questions"}</StatusBadge>
        </div>
        <ol aria-label="Test sections" className="flex flex-wrap gap-2">
          {order.map((skill, i) => (
            <li
              key={skill}
              aria-current={i === sectionIdx ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold",
                i === sectionIdx ? "bg-primary text-on-primary" : i < sectionIdx ? "bg-success-soft text-success" : "bg-surface text-muted ring-1 ring-line",
              )}
            >
              {i < sectionIdx && <Check className="size-4" aria-hidden />}
              {getSkill(skill).title}
              <span className="sr-only">{i < sectionIdx ? "(finished)" : i === sectionIdx ? "(current)" : "(next)"}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr]">
        <div className="order-1 xl:col-start-2 xl:row-start-1">
          <CountdownTimer key={part.id} totalSeconds={part.minutes * 60} title={`${part.title} time`} stopped={submitting} pausable={false} onExpire={() => endSection(true)} />
        </div>

        <section aria-label={`Question ${index + 1}`} className="order-2 min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <p className={cn("text-sm font-bold uppercase tracking-wide", SKILL_TONE[unit.skill].text)}>{getSkill(unit.skill).title}</p>
                <h2 className="text-xl font-bold text-ink">{unit.title}</h2>
              </div>
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-semibold text-ink tabular-nums">
                Question {index + 1} of {sectionUnits.length}
              </span>
            </header>
            <div className="flex flex-col gap-5 p-5">
              <UnitView
                key={unit.key}
                unit={unit}
                answer={answers[unit.key]}
                onAnswer={set}
                onRecorded={(r) => recordSpeaking(unit, r)}
                upload={uploadState[unit.key]}
                played={!!played[audioKey(unit)]}
                onPlayStart={() => setPlayed((p) => ({ ...p, [audioKey(unit)]: true }))}
                heard={!!heard[audioKey(unit)]}
                onHeard={() => setHeard((h) => ({ ...h, [audioKey(unit)]: true }))}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="lg" leftIcon={<ArrowLeft className="size-4" />} disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Previous
            </Button>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="lg"
                aria-pressed={!!flagged[unit.key]}
                leftIcon={flagged[unit.key] ? <BookmarkCheck className="size-4 text-warning" /> : <Bookmark className="size-4" />}
                onClick={() => setFlagged((f) => ({ ...f, [unit.key]: !f[unit.key] }))}
              >
                {flagged[unit.key] ? "Marked" : "Mark for Review"}
              </Button>
              {index < sectionUnits.length - 1 ? (
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => setIndex(index + 1)}>
                  Next
                </Button>
              ) : (
                <Button size="lg" rightIcon={isLastSection ? <Send className="size-4" /> : <ArrowRight className="size-4" />} onClick={() => setConfirm(true)} loading={submitting}>
                  {isLastSection ? "Submit Test" : nextIsNewSection ? "Finish Section" : "Next Part"}
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="order-3 flex flex-col gap-5 xl:col-start-2 xl:row-start-2">
          <QuestionNavigation showScores={false} items={sectionUnits.map((u) => ({ id: u.key, status: isAnswered(u) ? "answered" : "unanswered", flagged: flagged[u.key] }))} current={index} onSelect={setIndex} />
          <Button variant="secondary" fullWidth leftIcon={isLastSection ? <Send className="size-4" /> : <ArrowRight className="size-4" />} onClick={() => setConfirm(true)} loading={submitting}>
            {isLastSection ? "Submit Test" : `Finish ${part.title}`}
          </Button>
          <p className="text-xs text-muted">
            Each section has its own time; in Writing, each task has its own time. When it ends, the next part starts and you cannot go back.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={isLastSection ? "Submit your test?" : `Finish ${part.title}?`}
        description={
          (unansweredHere ? `You have ${unansweredHere} unanswered question${unansweredHere === 1 ? "" : "s"} in this part. ` : "") +
          (isLastSection ? "You cannot change answers after submitting." : "You cannot come back to this part.")
        }
        confirmLabel={submitting ? "Submitting…" : isLastSection ? "Submit" : nextIsNewSection ? "Next section" : "Next part"}
        cancelLabel="Keep working"
        onCancel={() => setConfirm(false)}
        onConfirm={() => endSection(false)}
      />
      {submitting && <MockTestSubmitting stage={stage} />}
    </div>
  );
}

type UploadState = "uploading" | "saved" | "failed";

/** One key per audio clip, shared by the questions about it. */
const audioKey = (u: Unit) => {
  const audio = u.kind === "choice" || u.kind === "speaking" ? u.audio : undefined;
  return audio?.source ? `${audio.source.itemId}:${audio.source.role}` : u.key;
};

interface UnitViewProps {
  unit: Unit;
  answer: unknown;
  onAnswer: (a: unknown) => void;
  onRecorded: (r: RecordingResult) => void;
  upload?: UploadState;
  played: boolean;
  onPlayStart: () => void;
  heard: boolean;
  onHeard: () => void;
}

// Test conditions: audio plays once with no stop or replay, and a saved spoken answer cannot be re-recorded.
function UnitView({ unit, answer, onAnswer, onRecorded, upload, played, onPlayStart, heard, onHeard }: UnitViewProps) {
  // Played on an earlier visit but not to the end (the learner moved on): the audio cannot be replayed, so show the question.
  const [playedOnMount] = useState(played);
  if (unit.kind === "choice") {
    const showQuestion = !unit.audio || heard || playedOnMount;
    return (
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", (unit.document || unit.passage) && "lg:grid-cols-2")}>
        {(unit.document || unit.passage || unit.audio) && (
          <div className="min-w-0">
            {unit.audio && <AudioPlayer audio={unit.audio} label="Play audio" transcript={false} testMode played={played} onPlayStart={onPlayStart} onEnded={onHeard} />}
            {/* Every document type (email, notice, text messages), the same view as in practice. */}
            {unit.document && <DocumentView doc={unit.document} />}
            {unit.passage && (
              <article className="max-h-96 overflow-y-auto rounded-xl border border-line bg-surface-soft p-4 text-[15px] leading-relaxed text-body">
                <h3 className="font-bold text-ink">{unit.passage.title}</h3>
                {unit.passage.paragraphs.map((p, i) => (
                  <p key={i} className="mt-2">
                    {p}
                  </p>
                ))}
              </article>
            )}
          </div>
        )}
        {showQuestion ? (
          <ChoiceList question={unit.question} value={typeof answer === "string" ? answer : undefined} onChange={onAnswer} />
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong bg-surface-soft p-5 text-center text-sm text-body" role="status">
            Play the audio and listen carefully. The question appears when it finishes, like on the real test. You can take notes.
          </p>
        )}
      </div>
    );
  }
  if (unit.kind === "ctw") return <CtwView unit={unit} answer={(answer as Record<string, string> | undefined) ?? {}} onAnswer={onAnswer} />;
  if (unit.kind === "build") return <BuildView unit={unit} answer={answer as (string | null)[] | undefined} onAnswer={onAnswer} />;
  if (unit.kind === "writing") {
    const text = (answer as { body?: string } | undefined)?.body ?? "";
    const discussion = unit.professor !== null;
    return (
      <div className="flex flex-col gap-4">
        {discussion ? (
          <div className="flex flex-col gap-3 text-[15px] text-body">
            <p>{unit.scenario}</p>
            <div className="rounded-xl border border-line bg-surface-soft p-4">
              <p className="text-sm font-bold text-ink">{unit.professor!.name} (professor)</p>
              <p className="mt-1">{unit.professor!.prompt}</p>
            </div>
            {unit.students.map((st) => (
              <div key={st.name} className="rounded-xl border border-line p-4">
                <p className="text-sm font-bold text-ink">{st.name}</p>
                <p className="mt-1">{st.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[15px] text-body">
            <p>{unit.scenario}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {unit.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {(unit.recipient || unit.subject) && (
              <p className="mt-3 text-sm text-muted">
                {unit.recipient && (
                  <>
                    <span className="font-semibold text-ink">To:</span> {unit.recipient}{" "}
                  </>
                )}
                {unit.subject && (
                  <>
                    <span className="font-semibold text-ink">Subject:</span> {unit.subject}
                  </>
                )}
              </p>
            )}
          </div>
        )}
        <Textarea
          label={discussion ? "Your post" : "Your email"}
          value={text}
          onChange={(e) => onAnswer(e.target.value ? { body: e.target.value } : undefined)}
          placeholder={discussion ? "Write your contribution to the discussion…" : "Write your email here…"}
          hint={`Word count: ${countWords(text)}`}
          className="min-h-56"
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-body">{unit.intro}</p>
      <p className="text-sm text-muted">
        {unit.repeat
          ? "Listen to the sentence once, then record yourself saying exactly the same sentence."
          : "Listen to the interviewer's question, then record your answer."}{" "}
        Your recordings are transcribed after you submit and deleted once scored.
      </p>
      <AudioPlayer audio={unit.audio} label={unit.repeat ? "Play sentence" : "Play question"} transcript={false} testMode played={played} onPlayStart={onPlayStart} />
      {upload === "uploading" && (
        <p className="flex items-center gap-2 rounded-lg bg-primary-soft p-3 text-sm font-semibold text-primary" role="status">
          <LoadingWave label="Saving" /> Saving your answer…
        </p>
      )}
      {upload !== "uploading" && answer !== undefined && (
        <p className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-success" role="status">
          Your answer is saved. Like the real test, it cannot be recorded again.
        </p>
      )}
      {upload === "failed" && answer === undefined && (
        <p className="rounded-lg bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
          Your last answer could not be saved. Please record it again.
        </p>
      )}
      {answer === undefined && (
        <div className="rounded-xl bg-speaking-soft/60 p-4">
          <RecordingControl maxSeconds={unit.responseSeconds} onRecorded={onRecorded} onCleared={() => onAnswer(undefined)} testMode />
        </div>
      )}
    </div>
  );
}

/** A Complete the Words passage: every blank on one screen. */
function CtwView({ unit, answer, onAnswer }: { unit: Extract<Unit, { kind: "ctw" }>; answer: Record<string, string>; onAnswer: (a: unknown) => void }) {
  const set = (blank: string, v: string) => {
    const next = { ...answer, [blank]: v };
    onAnswer(Object.values(next).some((x) => x.trim()) ? next : undefined);
  };
  const filled = unit.blanks.filter((b) => (answer[b] ?? "").trim()).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Fill in the missing letters to complete each word. {filled} of {unit.blanks.length} filled.
      </p>
      <article aria-label={unit.passageTitle} className="rounded-xl border border-line p-4 text-[17px] leading-[3.2] text-body sm:p-6">
        <h3 className="sr-only">{unit.passageTitle}</h3>
        {unit.segments.map((seg, i) => {
          if (seg.type === "text") return <span key={i}>{seg.text}</span>;
          return (
            <span key={seg.unitId} className="inline-flex items-baseline">
              <span>{seg.prefix}</span>
              <LetterBoxes
                length={seg.length}
                value={answer[seg.unitId] ?? ""}
                onChange={(v) => set(seg.unitId, v)}
                label={`Missing letters for the word starting with “${seg.prefix}”`}
                status={(answer[seg.unitId] ?? "").trim() ? "answered" : "unanswered"}
              />
            </span>
          );
        })}
      </article>
    </div>
  );
}

/** Build a Sentence: tap the word groups in order; tap a placed group to take it back. */
function BuildView({ unit, answer, onAnswer }: { unit: Extract<Unit, { kind: "build" }>; answer: (string | null)[] | undefined; onAnswer: (a: unknown) => void }) {
  const slots = answer ?? Array<string | null>(unit.tokens.length).fill(null);
  const textOf = (id: string) => unit.tokens.find((t) => t.id === id)?.text ?? "";
  const bank = unit.tokens.filter((t) => !slots.includes(t.id));
  const setSlots = (next: (string | null)[]) => onAnswer(next.some((v) => v !== null) ? next : undefined);
  const place = (id: string) => {
    const at = slots.indexOf(null);
    if (at < 0) return;
    setSlots(slots.map((v, i) => (i === at ? id : v)));
  };
  return (
    <div className="rounded-xl border border-line p-4 sm:p-6">
      <p className="mb-5 text-base font-semibold text-ink">Make an appropriate sentence.</p>
      <p className="text-base text-ink sm:text-lg">{unit.context}</p>
      <ol className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-4" aria-label="Your sentence">
        {unit.prefix && <li className="pb-1 text-lg text-ink">{unit.prefix}</li>}
        {slots.map((token, i) => (
          <li key={i}>
            {token === null ? (
              <span className="block h-8 w-16 border-b-2 border-ink sm:w-20" role="img" aria-label={`Blank ${i + 1} of ${slots.length}, empty`} />
            ) : (
              <button
                type="button"
                onClick={() => setSlots(slots.map((v, j) => (j === i ? null : v)))}
                aria-label={`Blank ${i + 1}: ${textOf(token)}. Click to remove.`}
                className="rounded border-b-2 border-ink px-1 pb-0.5 text-lg font-semibold text-brand-700 hover:border-danger hover:text-danger dark:text-primary"
              >
                {textOf(token)}
              </button>
            )}
          </li>
        ))}
        {unit.suffix && <li className="pb-1 text-lg text-ink">{unit.suffix}</li>}
      </ol>
      <div className="mt-8 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Word bank">
        {bank.length === 0 ? (
          <span className="text-sm text-muted">All words placed. Click a word in the sentence to move it back.</span>
        ) : (
          bank.map((t) => (
            <button key={t.id} type="button" onClick={() => place(t.id)} className="rounded px-1 text-lg font-semibold text-brand-700 hover:underline dark:text-primary">
              {t.text}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
