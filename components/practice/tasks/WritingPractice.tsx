"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, CircleAlert, ListChecks, Mail, PencilLine, Save, Send } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { WritingSet } from "@/lib/services/types";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { updateDemo, useDemoState, useHydrated } from "@/lib/store/demo-store";
import { runWritingChecks } from "@/lib/utils/writing-checks";
import { countWords, initials } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { CountdownTimer } from "../CountdownTimer";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { SampleSetCard } from "../SampleSetCard";
import { usePracticeSession } from "../usePracticeSession";
import { cn } from "@/lib/utils/cn";

interface Draft {
  to?: string;
  subject?: string;
  body: string;
}

const AVATAR_TONES = ["bg-reading-soft text-reading", "bg-listening-soft text-listening", "bg-speaking-soft text-speaking"];

export function WritingPractice({ type, content, sampleCount }: { type: PracticeType; content: WritingSet; sampleCount: number }) {
  const items = content.items;
  const isEmail = content.kind === "write-email";
  const unitIds = useMemo(() => items.map((i) => i.id), [items]);
  const grade = useCallback(() => null, []);
  const s = usePracticeSession<Draft>({ slug: type.slug, unitIds, grade, gradable: false });
  const { drafts } = useDemoState();
  const hydrated = useHydrated();
  const toast = useToast();
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean[]>>({});
  const [loadedDrafts, setLoadedDrafts] = useState(false);

  const task = items[s.index];
  const draft: Draft = s.answers[task.id] ?? { to: task.recipient, subject: task.subject, body: "" };
  const words = countWords(draft.body);
  const submitted = !!s.checked[task.id];
  const isLast = s.index === items.length - 1;
  const ticks = selfCheck[task.id] ?? task.checklist.map(() => false);
  const checks = useMemo(() => (submitted ? runWritingChecks(task, content.kind, draft.body) : []), [submitted, task, content.kind, draft.body]);

  // Restore saved drafts once, after hydration.
  useEffect(() => {
    if (!hydrated || loadedDrafts) return;
    setLoadedDrafts(true);
    for (const item of items) {
      const saved = drafts[`${type.slug}:${item.id}`];
      if (saved?.body) s.answer(item.id, saved);
    }
  }, [hydrated, loadedDrafts, drafts, items, s, type.slug]);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    s.answer(task.id, next.body.trim() ? next : undefined);
  };

  const saveDraft = () => {
    updateDemo((st) => ({ ...st, drafts: { ...st.drafts, [`${type.slug}:${task.id}`]: draft } }));
    toast("Draft saved in this browser.");
  };

  return (
    <PracticeLayout
      type={type}
      position={`${s.index + 1} of ${items.length}`}
      timer={<CountdownTimer key={s.resetKey} totalSeconds={type.timeLimitSeconds} stopped={s.finished} />}
      sidebar={
        <>
          <section aria-label="Task checklist" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                <ListChecks className="size-5 text-primary" aria-hidden /> Task Checklist
              </h2>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {ticks.filter(Boolean).length} / {task.checklist.length}
              </span>
            </div>
            <p className="mb-2 text-xs text-muted">Tick each point when your response covers it.</p>
            <ul className="space-y-2">
              {task.checklist.map((c, i) => (
                <li key={c}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1.5 text-sm text-body hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                      checked={ticks[i]}
                      onChange={(e) => setSelfCheck((sc) => ({ ...sc, [task.id]: ticks.map((t, j) => (j === i ? e.target.checked : t)) }))}
                    />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          </section>
          {items.length > 1 && <QuestionNavigation title="Tasks" items={items.map((i) => ({ id: i.id, status: s.statusOf(i.id) }))} current={s.index} onSelect={s.setIndex} />}
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
            onRetry={() => {
              setSelfCheck({});
              s.reset();
            }}
            note="Writing is not auto-scored in this demo. AI feedback will be added when the AI service is connected."
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
            <>
              <Button variant="secondary" size="lg" leftIcon={<Save className="size-4" />} onClick={saveDraft} disabled={!draft.body.trim()}>
                Save Draft
              </Button>
              {!submitted ? (
                <Button size="lg" rightIcon={<Send className="size-4" />} onClick={() => s.check(task.id)} disabled={!draft.body.trim()}>
                  Submit for Feedback
                </Button>
              ) : !isLast ? (
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => s.setIndex(s.index + 1)}>
                  Next Task
                </Button>
              ) : (
                !s.finished && (
                  <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={s.finish}>
                    Finish
                  </Button>
                )
              )}
            </>
          }
        />
      }
    >
      {isEmail ? (
        <div className={cn("grid gap-5", task.illustration && "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
          {task.illustration && (
            <Image
              src={ILLUSTRATIONS[task.illustration].src}
              alt="Illustration of a tent and backpack near mountains and a lake"
              width={ILLUSTRATIONS[task.illustration].width}
              height={ILLUSTRATIONS[task.illustration].height}
              className="h-auto w-full rounded-xl object-cover"
            />
          )}
          <div className="text-[15px] leading-relaxed text-body">
            <p>{task.scenario}</p>
            <p className="mt-3 font-bold text-ink">In your email, do the following:</p>
            <ol className="mt-2 space-y-2">
              {task.bullets.map((b, i) => (
                <li key={b} className="flex gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                  {b}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-body">{task.scenario}</p>
          {task.professor && (
            <DiscussionPost name={task.professor.name} role="Professor" text={task.professor.prompt} tone="bg-primary-soft" avatar="bg-primary text-on-primary" />
          )}
          {task.students?.map((st, i) => (
            <DiscussionPost key={st.name} name={st.name} role="Student" text={st.text} tone={i === 0 ? "bg-listening-soft" : "bg-speaking-soft"} avatar={AVATAR_TONES[(i + 1) % 3]} />
          ))}
        </div>
      )}

      <section aria-label="Your response" className="rounded-xl border border-line p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            {isEmail ? <Mail className="size-5 text-primary" aria-hidden /> : <PencilLine className="size-5 text-primary" aria-hidden />} Your Response
          </h2>
          <span className={cn("text-sm tabular-nums", task.maxWords && words > task.maxWords ? "font-semibold text-danger" : "text-muted")} aria-live="polite">
            Word count: {words}
            {task.maxWords ? ` / ${task.maxWords}` : ""}
          </span>
        </div>
        {isEmail && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Input label="To" value={draft.to ?? ""} onChange={(e) => update({ to: e.target.value })} disabled={submitted} />
            <Input label="Subject" value={draft.subject ?? ""} onChange={(e) => update({ subject: e.target.value })} disabled={submitted} />
          </div>
        )}
        <Textarea
          label={isEmail ? "Email" : "Response"}
          srOnlyLabel
          placeholder={isEmail ? "Write your email here…" : "Write your response here…"}
          value={draft.body}
          onChange={(e) => update({ body: e.target.value })}
          readOnly={submitted}
          className="min-h-52"
          hint={`Aim for at least ${task.minWords} words.`}
        />
        {submitted && !s.finished && (
          <button type="button" onClick={() => s.answer(task.id, draft)} className="mt-2 text-sm font-semibold text-primary hover:underline">
            Edit response
          </button>
        )}
      </section>

      {submitted && (
        <section aria-label="Feedback" className="rounded-xl border border-line bg-surface-soft p-4 sm:p-5" role="status">
          <h2 className="text-base font-bold text-ink">Automatic writing checks</h2>
          <p className="mt-0.5 text-xs text-muted">These checks look at length and structure only. They are not AI scoring. AI feedback is not connected yet.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2 rounded-lg bg-surface p-3 text-sm">
                {c.passed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Passed" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-label="Needs work" />}
                <span>
                  <span className="block font-semibold text-ink">{c.label}</span>
                  <span className="text-body">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-2 text-sm text-body">
            <Circle className="size-3 fill-primary text-primary" aria-hidden />
            Self-check: {ticks.filter(Boolean).length} of {task.checklist.length} task points ticked.
          </p>
        </section>
      )}
    </PracticeLayout>
  );
}

function DiscussionPost({ name, role, text, tone, avatar }: { name: string; role: string; text: string; tone: string; avatar: string }) {
  return (
    <article className="flex gap-3 sm:gap-4">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center sm:w-20">
        <span className={cn("inline-flex size-12 items-center justify-center rounded-full text-base font-bold sm:size-14", avatar)} aria-hidden>
          {initials(name.replace(/^Dr\.\s*/, ""))}
        </span>
        <span className="text-sm font-bold text-ink">{name}</span>
        <span className="text-[11px] text-muted">{role}</span>
      </div>
      <p className={cn("flex-1 rounded-2xl p-4 text-[15px] leading-relaxed text-body", tone)}>{text}</p>
    </article>
  );
}
