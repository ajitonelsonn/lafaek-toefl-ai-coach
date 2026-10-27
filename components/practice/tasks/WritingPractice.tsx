"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, ListChecks, Mail, PencilLine, Save, Send, Sparkles } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { PracticeView } from "@/lib/practice/dto";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { api, errorMessage } from "@/lib/client/api";
import { countWords, initials } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { PracticeFooter, PracticeLayout } from "../PracticeLayout";
import { QuestionNavigation } from "../QuestionNavigation";
import { ResultsPanel } from "../ResultsPanel";
import { unitKey, usePracticeSession } from "../usePracticeSession";
import { ItemImage } from "./ListeningPractice";
import { AiFeedbackPanel, type AiFeedback } from "./AiFeedbackPanel";
import { cn } from "@/lib/utils/cn";

interface Draft {
  to?: string;
  subject?: string;
  body: string;
}

type WritingView = Extract<PracticeView, { kind: "write-email" | "academic-discussion" }>;
const AVATAR_TONES = ["bg-reading-soft text-reading", "bg-listening-soft text-listening", "bg-speaking-soft text-speaking"];

export function WritingPractice({ type, view, sidebarExtra }: { type: PracticeType; view: WritingView; sidebarExtra: ReactNode }) {
  const items = view.items;
  const isEmail = view.kind === "write-email";
  const unitKeys = useMemo(() => items.map((i) => unitKey(i.itemId, i.unitId)), [items]);
  const s = usePracticeSession<Draft>({ unitKeys, gradable: false });
  const toast = useToast();
  const [selfCheck, setSelfCheck] = useState<Record<string, boolean[]>>({});
  const [coaching, setCoaching] = useState<Record<string, { feedback: AiFeedback; label: string }>>({});
  const [coachBusy, setCoachBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const task = items[s.index];
  const key = unitKey(task.itemId, task.unitId);
  const draft: Draft = s.answers[key] ?? task.draft ?? { to: task.recipient ?? undefined, subject: task.subject ?? undefined, body: "" };
  const words = countWords(draft.body);
  const result = s.results[key];
  const submitted = Boolean(result);
  const isLast = s.index === items.length - 1;
  const ticks = selfCheck[key] ?? task.checklist.map(() => false);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    s.answer(key, next.body.trim() ? next : undefined);
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await api(`/api/practice/items/${task.itemId}/draft`, { method: "PUT", body: { to: draft.to, subject: draft.subject, body: draft.body } });
      toast("Draft saved to your account.");
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!(key in s.answers)) s.answer(key, draft);
    await s.check(key, draft);
  };

  const coach = async () => {
    setCoachBusy(true);
    try {
      const r = await api<{ feedback: AiFeedback; label: string }>(`/api/practice/items/${task.itemId}/feedback`, { body: { unitId: task.unitId, text: draft.body } });
      setCoaching((c) => ({ ...c, [key]: r }));
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setCoachBusy(false);
    }
  };

  return (
    <PracticeLayout
      type={type}
      source={task.source}
      position={`${s.index + 1} of ${items.length}`}
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
                      onChange={(e) => setSelfCheck((sc) => ({ ...sc, [key]: ticks.map((t, j) => (j === i ? e.target.checked : t)) }))}
                    />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          </section>
          {items.length > 1 && <QuestionNavigation title="Tasks" items={unitKeys.map((k) => ({ id: k, status: s.statusOf(k) }))} current={s.index} onSelect={s.setIndex} />}
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
            onRetry={() => {
              setSelfCheck({});
              setCoaching({});
              s.reset();
            }}
            note="Writing is not auto-scored. Use “Get AI coaching” for feedback on each response."
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
              <Button variant="secondary" size="lg" leftIcon={<Save className="size-4" />} onClick={saveDraft} loading={saving} disabled={!draft.body.trim()}>
                Save Draft
              </Button>
              {!submitted ? (
                <Button size="lg" rightIcon={<Send className="size-4" />} onClick={() => void submit()} loading={s.pending} disabled={!draft.body.trim()}>
                  Submit
                </Button>
              ) : !isLast ? (
                <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => s.setIndex(s.index + 1)}>
                  Next Task
                </Button>
              ) : (
                !s.finished && (
                  <Button size="lg" rightIcon={<ArrowRight className="size-4" />} onClick={() => void s.finish()}>
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
        <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-5", (task.illustration || task.imageAssetId) && "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
          {(task.illustration || task.imageAssetId) && (
            <ItemImage
              assetId={task.imageAssetId}
              alt="Illustration for the email task"
              fallback={
                task.illustration ? (
                  <Image src={ILLUSTRATIONS.emailHiking.src} alt="Illustration of a tent and backpack near mountains and a lake" width={ILLUSTRATIONS.emailHiking.width} height={ILLUSTRATIONS.emailHiking.height} className="h-auto w-full rounded-xl object-cover" />
                ) : null
              }
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
          {task.professor && <DiscussionPost name={task.professor.name} role="Professor" text={task.professor.prompt} tone="bg-primary-soft" avatar="bg-primary text-on-primary" />}
          {task.students.map((st, i) => (
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
          hint={`Suggested length: at least ${task.minWords} words (a practice guideline).`}
        />
        {submitted && !s.finished && (
          <button type="button" onClick={() => s.answer(key, draft)} className="mt-2 text-sm font-semibold text-primary hover:underline">
            Edit response
          </button>
        )}
      </section>

      {result && (
        <section aria-label="Feedback" className="rounded-xl border border-line bg-surface-soft p-4 sm:p-5" role="status">
          <h2 className="text-base font-bold text-ink">Automatic writing checks</h2>
          <p className="mt-0.5 text-xs text-muted">{result.label ?? "These checks look at length and structure only."}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(result.checks ?? []).map((c) => (
              <li key={c.id} className="flex gap-2 rounded-lg bg-surface p-3 text-sm">
                {c.passed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Passed" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-label="Needs work" />}
                <span>
                  <span className="block font-semibold text-ink">{c.label}</span>
                  <span className="text-body">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {!coaching[key] && (
            <Button className="mt-4" variant="soft" leftIcon={<Sparkles className="size-4" />} loading={coachBusy} onClick={() => void coach()}>
              Get AI coaching
            </Button>
          )}
        </section>
      )}
      {coaching[key] && <AiFeedbackPanel feedback={coaching[key].feedback} label={coaching[key].label} />}
    </PracticeLayout>
  );
}

function DiscussionPost({ name, role, text, tone, avatar }: { name: string; role: string; text: string; tone: string; avatar: string }) {
  return (
    <article className="flex gap-3 sm:gap-4">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center sm:w-20">
        <span className={cn("inline-flex size-12 items-center justify-center rounded-full text-base font-bold sm:size-14", avatar)} aria-hidden>
          {initials(name.replace(/^(Dr|Prof|Professor)\.?\s*/i, ""))}
        </span>
        <span className="text-sm font-bold text-ink">{name}</span>
        <span className="text-[11px] text-muted">{role}</span>
      </div>
      <p className={cn("flex-1 rounded-2xl p-4 text-[15px] leading-relaxed text-body", tone)}>{text}</p>
    </article>
  );
}
