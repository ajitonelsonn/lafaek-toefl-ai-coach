"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Send } from "lucide-react";
import { SKILLS, getSkill, type SkillId } from "@/lib/config/practice-types";
import { MOCK_DEMO_MINUTES, itemsForSections, type MockItem } from "@/lib/mock-data/mock-test";
import { updateDemo, type MockTestResult } from "@/lib/store/demo-store";
import { countWords } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/States";
import { DemoBadge } from "@/components/ui/StatusBadge";
import { CountdownTimer } from "@/components/practice/CountdownTimer";
import { QuestionNavigation } from "@/components/practice/QuestionNavigation";
import { ChoiceList } from "@/components/practice/ChoiceList";
import { AudioPlayer } from "@/components/practice/AudioPlayer";
import { RecordingControl, type RecordingResult } from "@/components/practice/RecordingControl";
import { SKILL_TONE } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

type Answer = string | RecordingResult;

function isAnswered(item: MockItem, a: Answer | undefined) {
  if (a === undefined) return false;
  if (item.kind === "writing") return typeof a === "string" && a.trim().length > 0;
  return true;
}

export function MockTestSession({ sectionsParam }: { sectionsParam: string | undefined }) {
  const router = useRouter();
  const sections = useMemo(() => {
    const ids = (sectionsParam ?? "").split(",").filter((s): s is SkillId => SKILLS.some((k) => k.id === s));
    return ids.length ? ids : SKILLS.map((s) => s.id);
  }, [sectionsParam]);
  const items = useMemo(() => itemsForSections(sections), [sections]);
  const totalSeconds = sections.reduce((n, s) => n + MOCK_DEMO_MINUTES[s], 0) * 60;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (submitted.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (!items.length) {
    return <EmptyState title="No questions in this test" description="Go back and choose at least one section." action={<Link href="/mock-test" className="font-semibold text-primary">Back to Mock Test</Link>} />;
  }

  const item = items[index];
  const unanswered = items.filter((i) => !isAnswered(i, answers[i.id])).length;
  const set = (value: Answer | undefined) =>
    setAnswers((a) => {
      const next = { ...a };
      if (value === undefined) delete next[item.id];
      else next[item.id] = value;
      return next;
    });

  const submit = () => {
    submitted.current = true;
    const result: MockTestResult = {
      completedAt: new Date().toISOString(),
      durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      sections: sections.map((skill) => {
        const list = items.filter((i) => i.skill === skill);
        const answered = list.filter((i) => isAnswered(i, answers[i.id])).length;
        const choice = list.filter((i) => i.kind === "choice");
        if (choice.length) {
          const correct = choice.filter((i) => i.kind === "choice" && answers[i.id] === i.question.answerId).length;
          return { skill, correct, total: choice.length, answered };
        }
        const first = list[0];
        const note =
          first?.kind === "writing"
            ? `${countWords(String(answers[first.id] ?? ""))} words written. AI scoring is not connected.`
            : answered
              ? "Response recorded. AI scoring is not connected."
              : "No response recorded.";
        return { skill, correct: null, total: list.length, answered, note };
      }),
    };
    updateDemo((s) => ({ ...s, mockResult: result }));
    router.push("/mock-test/results");
  };

  const sectionIndexStart = (skill: SkillId) => items.findIndex((i) => i.skill === skill);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">Mock Test</h1>
          <DemoBadge>Demo test · sample questions</DemoBadge>
        </div>
        <nav aria-label="Test sections" className="flex flex-wrap gap-2">
          {sections.map((skill) => {
            const active = item.skill === skill;
            return (
              <button
                key={skill}
                type="button"
                onClick={() => setIndex(sectionIndexStart(skill))}
                aria-current={active ? "step" : undefined}
                className={cn("rounded-full px-4 py-2 text-sm font-semibold", active ? "bg-primary text-on-primary" : cn("bg-surface text-body ring-1 ring-line hover:ring-primary"))}
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
                <p className={cn("text-sm font-bold uppercase tracking-wide", SKILL_TONE[item.skill].text)}>{getSkill(item.skill).title}</p>
                <h2 className="text-xl font-bold text-ink">{item.taskTitle}</h2>
              </div>
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-semibold text-ink tabular-nums">
                Question {index + 1} of {items.length}
              </span>
            </header>
            <div className="flex flex-col gap-5 p-5">
              {timeUp && (
                <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
                  Time is up. Please submit your test.
                </p>
              )}
              <MockItemView key={item.id} item={item} answer={answers[item.id]} onAnswer={set} />
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
                aria-pressed={!!flagged[item.id]}
                leftIcon={flagged[item.id] ? <BookmarkCheck className="size-4 text-warning" /> : <Bookmark className="size-4" />}
                onClick={() => setFlagged((f) => ({ ...f, [item.id]: !f[item.id] }))}
              >
                {flagged[item.id] ? "Marked" : "Mark for Review"}
              </Button>
              {index < items.length - 1 ? (
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
          <QuestionNavigation
            items={items.map((i) => ({ id: i.id, status: isAnswered(i, answers[i.id]) ? "answered" : "unanswered", flagged: flagged[i.id] }))}
            current={index}
            onSelect={setIndex}
          />
          <Button variant="secondary" fullWidth leftIcon={<Send className="size-4" />} onClick={() => setConfirm(true)}>
            Submit Test
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Submit your test?"
        description={
          unanswered
            ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. You cannot change answers after submitting.`
            : "You answered every question. You cannot change answers after submitting."
        }
        confirmLabel="Submit"
        cancelLabel="Keep working"
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      />
    </div>
  );
}

function MockItemView({ item, answer, onAnswer }: { item: MockItem; answer: Answer | undefined; onAnswer: (a: Answer | undefined) => void }) {
  if (item.kind === "choice") {
    return (
      <div className={cn("grid gap-5", (item.document || item.passage) && "lg:grid-cols-2")}>
        {(item.document || item.passage || item.audio) && (
          <div className="min-w-0">
            {item.audio && <AudioPlayer media={item.audio} label="Play audio" />}
            {item.document?.type === "email" && (
              <article className="rounded-xl border border-line bg-surface-soft p-4 text-[15px] leading-relaxed text-body">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">Subject:</span> {item.document.subject}
                </p>
                {item.document.body.map((p, i) => (
                  <p key={i} className="mt-2">
                    {p}
                  </p>
                ))}
              </article>
            )}
            {item.passage && (
              <article className="max-h-96 overflow-y-auto rounded-xl border border-line bg-surface-soft p-4 text-[15px] leading-relaxed text-body">
                <h3 className="font-bold text-ink">{item.passage.title}</h3>
                {item.passage.paragraphs.map((p, i) => (
                  <p key={i} className="mt-2">
                    {p}
                  </p>
                ))}
              </article>
            )}
          </div>
        )}
        <ChoiceList question={item.question} value={typeof answer === "string" ? answer : undefined} onChange={onAnswer} />
      </div>
    );
  }
  if (item.kind === "writing") {
    const text = typeof answer === "string" ? answer : "";
    return (
      <div className="flex flex-col gap-4">
        <div className="text-[15px] text-body">
          <p>{item.task.scenario}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {item.task.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <Textarea label="Your email" value={text} onChange={(e) => onAnswer(e.target.value || undefined)} placeholder="Write your email here…" hint={`Word count: ${countWords(text)}`} className="min-h-56" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-body">Listen to the interviewer&apos;s question, then record your answer.</p>
      <AudioPlayer media={item.audio} label="Play question" />
      {answer !== undefined && typeof answer !== "string" && (
        <p className="rounded-lg bg-success-soft p-3 text-sm font-semibold text-success" role="status">
          You already recorded a response ({answer.simulated ? "simulated" : `${answer.seconds}s`}). Recording again replaces it.
        </p>
      )}
      <div className="rounded-xl bg-speaking-soft/60 p-4">
        <RecordingControl maxSeconds={item.responseSeconds} onRecorded={(r) => onAnswer(r)} onCleared={() => onAnswer(undefined)} />
      </div>
    </div>
  );
}
