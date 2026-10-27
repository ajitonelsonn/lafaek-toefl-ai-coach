"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Send } from "lucide-react";
import { getSkill, type SkillId } from "@/lib/config/practice-types";
import { MOCK_DEMO_MINUTES } from "@/lib/config/mock-test";
import type { AudioDTO, ChoiceQuestionDTO, PracticeView } from "@/lib/practice/dto";
import type { DailyLifeDocument } from "@/lib/services/types";
import { api, errorMessage } from "@/lib/client/api";
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
import { RecordingControl } from "@/components/practice/RecordingControl";
import { SKILL_TONE } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

export interface MockFormItemDTO {
  skill: SkillId;
  units: string[];
  view: PracticeView;
}

type Unit =
  | { key: string; itemId: string; unitId: string; skill: SkillId; kind: "choice"; title: string; question: ChoiceQuestionDTO; document?: DailyLifeDocument; passage?: { title: string; paragraphs: string[] }; audio?: AudioDTO }
  | { key: string; itemId: string; unitId: string; skill: SkillId; kind: "writing"; title: string; scenario: string; bullets: string[] }
  | { key: string; itemId: string; unitId: string; skill: SkillId; kind: "speaking"; title: string; audio: AudioDTO; responseSeconds: number };

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
            out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, kind: "choice", title, question: q, document: it.document, passage: it.paragraphs ? { title: it.title, paragraphs: it.paragraphs } : undefined });
        break;
      case "listen-choose-response":
        for (const it of v.items) out.push({ key: key(it.itemId, it.question.unitId), itemId: it.itemId, unitId: it.question.unitId, skill: f.skill, kind: "choice", title, question: it.question, audio: it.audio });
        break;
      case "listen-conversation":
      case "listen-announcement":
      case "listen-academic-talk":
        for (const it of v.items)
          for (const q of it.questions.filter((q) => f.units.includes(q.unitId))) out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, kind: "choice", title, question: q, audio: it.audio });
        break;
      case "write-email":
      case "academic-discussion":
        for (const it of v.items) out.push({ key: key(it.itemId, it.unitId), itemId: it.itemId, unitId: it.unitId, skill: f.skill, kind: "writing", title, scenario: it.scenario, bullets: it.bullets });
        break;
      case "take-interview":
        for (const it of v.items)
          for (const q of it.questions.filter((q) => f.units.includes(q.unitId))) out.push({ key: key(it.itemId, q.unitId), itemId: it.itemId, unitId: q.unitId, skill: f.skill, kind: "speaking", title, audio: q.audio, responseSeconds: q.responseSeconds });
        break;
      default:
        break;
    }
  }
  return out;
}

export function MockTestSession({ form, sections }: { form: MockFormItemDTO[]; sections: SkillId[] }) {
  const router = useRouter();
  const toast = useToast();
  const units = useMemo(() => toUnits(form), [form]);
  const totalSeconds = sections.reduce((n, s) => n + MOCK_DEMO_MINUTES[s], 0) * 60;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);

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

  const unit = units[index];
  const isAnswered = (u: Unit) => {
    const a = answers[u.key];
    if (a === undefined) return false;
    if (u.kind === "writing") return typeof (a as { body?: string }).body === "string" && (a as { body: string }).body.trim().length > 0;
    return true;
  };
  const unanswered = units.filter((u) => !isAnswered(u)).length;
  const set = (value: unknown) =>
    setAnswers((a) => {
      const next = { ...a };
      if (value === undefined) delete next[unit.key];
      else next[unit.key] = value;
      return next;
    });

  const submit = async () => {
    setSubmitting(true);
    try {
      // Speaking is not uploaded in the mock test; only objective answers and writing are sent.
      const payload = units.filter((u) => u.kind !== "speaking" && isAnswered(u)).map((u) => ({ itemId: u.itemId, unitId: u.unitId, response: answers[u.key] }));
      const speakingDone = units.filter((u) => u.kind === "speaking" && isAnswered(u)).map((u) => ({ itemId: u.itemId, unitId: u.unitId, response: null }));
      await api("/api/mock-test/submit", {
        body: { sections, durationSeconds: Math.round((Date.now() - startedAt.current) / 1000), answers: [...payload, ...speakingDone] },
      });
      submitted.current = true;
      router.push("/mock-test/results");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "warning");
      setSubmitting(false);
      setConfirm(false);
    }
  };

  const sectionStart = (skill: SkillId) => units.findIndex((u) => u.skill === skill);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Mock Test</h1>
          <StatusBadge tone="warning">Practice test · starter questions</StatusBadge>
        </div>
        <nav aria-label="Test sections" className="flex flex-wrap gap-2">
          {sections.map((skill) => {
            const active = unit.skill === skill;
            const start = sectionStart(skill);
            if (start < 0) return null;
            return (
              <button
                key={skill}
                type="button"
                onClick={() => setIndex(start)}
                aria-current={active ? "step" : undefined}
                className={cn("rounded-full px-4 py-2 text-sm font-semibold", active ? "bg-primary text-on-primary" : "bg-surface text-body ring-1 ring-line hover:ring-primary")}
              >
                {getSkill(skill).title}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr]">
        <div className="order-1 xl:col-start-2 xl:row-start-1">
          <CountdownTimer totalSeconds={totalSeconds} title="Test Time" onExpire={() => setTimeUp(true)} />
        </div>

        <section aria-label={`Question ${index + 1}`} className="order-2 min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
              <div>
                <p className={cn("text-sm font-bold uppercase tracking-wide", SKILL_TONE[unit.skill].text)}>{getSkill(unit.skill).title}</p>
                <h2 className="text-xl font-bold text-ink">{unit.title}</h2>
              </div>
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-semibold text-ink tabular-nums">
                Question {index + 1} of {units.length}
              </span>
            </header>
            <div className="flex flex-col gap-5 p-5">
              {timeUp && (
                <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
                  Time is up. Please submit your test.
                </p>
              )}
              <UnitView key={unit.key} unit={unit} answer={answers[unit.key]} onAnswer={set} />
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
              {index < units.length - 1 ? (
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => setIndex(index + 1)}>
                  Next
                </Button>
              ) : (
                <Button size="lg" rightIcon={<Send className="size-4" />} onClick={() => setConfirm(true)}>
                  Submit Test
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="order-3 flex flex-col gap-5 xl:col-start-2 xl:row-start-2">
          <QuestionNavigation items={units.map((u) => ({ id: u.key, status: isAnswered(u) ? "answered" : "unanswered", flagged: flagged[u.key] }))} current={index} onSelect={setIndex} />
          <Button variant="secondary" fullWidth leftIcon={<Send className="size-4" />} onClick={() => setConfirm(true)}>
            Submit Test
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Submit your test?"
        description={unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. You cannot change answers after submitting.` : "You answered every question. You cannot change answers after submitting."}
        confirmLabel={submitting ? "Submitting…" : "Submit"}
        cancelLabel="Keep working"
        onCancel={() => setConfirm(false)}
        onConfirm={() => void submit()}
      />
    </div>
  );
}

function UnitView({ unit, answer, onAnswer }: { unit: Unit; answer: unknown; onAnswer: (a: unknown) => void }) {
  if (unit.kind === "choice") {
    return (
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", (unit.document || unit.passage) && "lg:grid-cols-2")}>
        {(unit.document || unit.passage || unit.audio) && (
          <div className="min-w-0">
            {unit.audio && <AudioPlayer audio={unit.audio} label="Play audio" transcript={false} />}
            {unit.document?.type === "email" && (
              <article className="rounded-xl border border-line bg-surface-soft p-4 text-[15px] leading-relaxed text-body">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">Subject:</span> {unit.document.subject}
                </p>
                {unit.document.body.map((p, i) => (
                  <p key={i} className="mt-2">
                    {p}
                  </p>
                ))}
              </article>
            )}
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
        <ChoiceList question={unit.question} value={typeof answer === "string" ? answer : undefined} onChange={onAnswer} />
      </div>
    );
  }
  if (unit.kind === "writing") {
    const text = (answer as { body?: string } | undefined)?.body ?? "";
    return (
      <div className="flex flex-col gap-4">
        <div className="text-[15px] text-body">
          <p>{unit.scenario}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {unit.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <Textarea label="Your email" value={text} onChange={(e) => onAnswer(e.target.value ? { body: e.target.value } : undefined)} placeholder="Write your email here…" hint={`Word count: ${countWords(text)}`} className="min-h-56" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-body">Listen to the interviewer&apos;s question, then record your answer. In the mock test, speaking is recorded for practice only and is not scored.</p>
      <AudioPlayer audio={unit.audio} label="Play question" transcript={false} />
      {answer !== undefined && (
        <p className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-success" role="status">
          You already answered this question. Recording again replaces it.
        </p>
      )}
      <div className="rounded-xl bg-speaking-soft/60 p-4">
        <RecordingControl maxSeconds={unit.responseSeconds} onRecorded={() => onAnswer("recorded")} onCleared={() => onAnswer(undefined)} />
      </div>
    </div>
  );
}
