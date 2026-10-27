"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CalendarRange, CheckCircle2, Circle, Pencil, RefreshCw, Trophy } from "lucide-react";
import { getPracticeType, practiceHref, type PracticeSlug } from "@/lib/config/practice-types";
import type { StudyPlanInputBody } from "@/lib/validation/schemas";
import type { GenerationBatchDTO } from "@/lib/practice/generation-dto";
import type { ProgressDTO } from "@/lib/practice/insights-dto";
import type { StudyPlanDTO } from "@/lib/practice/plan-dto";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { todayKey } from "@/lib/utils/dates";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { TipCard } from "@/components/ui/Callouts";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { GenerationProgress } from "@/components/generation/GenerationProgress";
import { SkillIconTile } from "@/components/practice/icons";
import { StudyPlanWizard } from "./StudyPlanWizard";
import { cn } from "@/lib/utils/cn";

type PlanDTO = StudyPlanDTO;
const KEY_STORAGE = "lafaek-toefl:generation-key";

/** Idempotency key for the generation start request; reused on retries so only one batch is created. */
function generationKey(): string {
  try {
    const existing = sessionStorage.getItem(KEY_STORAGE);
    if (existing) return existing;
    const k = crypto.randomUUID();
    sessionStorage.setItem(KEY_STORAGE, k);
    return k;
  } catch {
    return crypto.randomUUID();
  }
}

const PHASE_TONES = [
  { box: "border-reading/25 bg-reading-soft", text: "text-reading" },
  { box: "border-listening/25 bg-listening-soft", text: "text-listening" },
  { box: "border-writing/25 bg-writing-soft", text: "text-writing" },
  { box: "border-speaking/25 bg-speaking-soft", text: "text-speaking" },
];

export function StudyPlanPage({ plan: initialPlan, batch, progress }: { plan: PlanDTO | null; batch: GenerationBatchDTO | null; progress: ProgressDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [studyPlan, setStudyPlan] = useState(initialPlan);
  const [currentBatch, setCurrentBatch] = useState(batch);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const finish = async (input: StudyPlanInputBody) => {
    setSaving(true);
    try {
      const { plan } = await api<{ plan: PlanDTO }>("/api/study-plan", { body: { input, confirmNewVersion: Boolean(studyPlan) } });
      setStudyPlan(plan);
      try {
        const r = await api<{ batch: GenerationBatchDTO }>("/api/generation/start", { body: { idempotencyKey: generationKey() } });
        setCurrentBatch(r.batch);
        toast("Your study plan is saved. Personalised practice is being prepared.");
      } catch (e) {
        if (e instanceof ApiClientError && e.code === "FEATURE_NOT_AVAILABLE") toast("Your plan is updated. Your existing practice content stays available.", "info");
        else toast(errorMessage(e), "warning");
      }
      setEditing(false);
      setJustCreated(true);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setSaving(false);
    }
  };

  if (!studyPlan || editing) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <StudyPlanWizard initial={studyPlan?.input} onFinish={finish} onCancel={studyPlan ? () => setEditing(false) : undefined} saving={saving} />
        <TipCard title="How the plan works">
          <p>We suggest which of the 12 practice types to focus on each week, and give you a short list of tasks for each day.</p>
          <p>After you finish, AI creates personalised questions for every practice type in the background.</p>
        </TipCard>
      </div>
    );
  }

  const today = todayKey();
  const byTask = new Map(progress.byTask.map((t) => [t.slug, t]));
  const practisedToday = (href: string) => {
    const slug = href.startsWith("/practice/") ? (href.split("/")[2] as PracticeSlug) : null;
    const last = slug ? byTask.get(slug)?.lastPractisedAt : null;
    return last ? todayKey(new Date(last)) === today : false;
  };
  const completedUnits = Object.fromEntries(progress.byTask.map((t) => [t.slug, t.attemptedUnits]));
  const total = progress.byTask.reduce((n, t) => n + t.availableUnits, 0);
  const done = progress.byTask.reduce((n, t) => n + Math.min(t.availableUnits, t.attemptedUnits), 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const { input } = studyPlan;
  const doneToday = studyPlan.dailyTasks.filter((t) => practisedToday(t.href)).map((t) => t.id);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {justCreated && (
          <Card as="section" aria-labelledby="gen-title" className="border-primary/30">
            <CardHeader
              title={<span id="gen-title">Preparing your personalised practice</span>}
              description="You don't need to wait. Starter questions are ready now, and personalised questions appear as they finish."
              action={
                <LinkButton href="/practice" size="sm" rightIcon={<ArrowRight className="size-4" />}>
                  Start practising now
                </LinkButton>
              }
            />
            <GenerationProgress initial={currentBatch} hasPlan compact />
          </Card>
        )}

        <Card as="section" aria-labelledby="goal-title">
          <CardHeader
            title={
              <span id="goal-title" className="flex items-center gap-3">
                <StepNumber n={1} /> Your Goal
              </span>
            }
            description="Your target score and study schedule."
            action={
              <Button variant="secondary" size="sm" leftIcon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit plan
              </Button>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-line p-4">
              <Trophy className="size-8 text-warning" aria-hidden />
              <div>
                <p className="text-sm text-muted">Target TOEFL score</p>
                <p className="text-2xl font-bold text-ink">{input.targetScore}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line p-4">
              <CalendarRange className="size-8 text-listening" aria-hidden />
              <div>
                <p className="text-sm text-muted">Plan length</p>
                <p className="text-2xl font-bold text-ink">{studyPlan.totalWeeks} weeks</p>
              </div>
            </div>
            <div className="rounded-xl border border-success/30 bg-success-soft p-4">
              <p className="font-bold text-success">Your goal</p>
              <p className="text-sm text-body">
                Score <span className="font-bold text-primary">{input.targetScore}</span> in {studyPlan.totalWeeks} weeks · {input.dailyMinutes} min a day ·{" "}
                {input.studyDays.length} days a week
              </p>
            </div>
          </div>
        </Card>

        <Card as="section" aria-labelledby="weekly-title">
          <CardHeader
            title={
              <span id="weekly-title" className="flex items-center gap-3">
                <StepNumber n={2} /> Weekly Study Plan
              </span>
            }
            description="Based on your goal and level. Ticks show practice types you have tried."
            action={
              <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="size-4" />} onClick={() => setConfirmReset(true)}>
                Make a new plan
              </Button>
            }
          />
          <ol className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {studyPlan.phases.map((phase, i) => (
              <li key={phase.title} className={cn("flex flex-col rounded-xl border", PHASE_TONES[i].box)}>
                <div className="p-4 pb-2">
                  <p className={cn("text-lg font-bold", PHASE_TONES[i].text)}>{phase.weeks}</p>
                  <p className={cn("text-sm font-semibold", PHASE_TONES[i].text)}>{phase.title}</p>
                </div>
                <ul className="flex-1 space-y-2 bg-surface/70 px-4 py-3 text-sm">
                  {phase.tasks.map((t) => {
                    const done = t.slug ? (completedUnits[t.slug] ?? 0) > 0 : false;
                    return (
                      <li key={t.label} className="flex items-start gap-2">
                        {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Tried" /> : <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" aria-label="Not tried yet" />}
                        {t.slug ? (
                          <Link href={practiceHref(t.slug)} className="text-body hover:text-primary hover:underline">
                            {t.label}
                          </Link>
                        ) : (
                          <span className="text-body">{t.label}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="p-4 pt-2 text-xs text-body">{phase.focus}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card as="section" aria-labelledby="today-title">
          <CardHeader
            title={
              <span id="today-title" className="flex items-center gap-3">
                <StepNumber n={3} /> Today&apos;s Recommended Practice
              </span>
            }
            description="Your tasks for today."
          />
          <ul className="grid gap-3 md:grid-cols-2">
            {studyPlan.dailyTasks.map((task) => {
              const slug = task.href.startsWith("/practice/") ? task.href.split("/")[2] : null;
              const type = slug ? getPracticeType(slug) : undefined;
              return (
                <li key={task.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                  {type ? <SkillIconTile skill={type.skill} slug={type.slug} /> : <SkillIconTile skill="reading" className="bg-primary-soft text-primary" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{task.label}</p>
                    <p className="text-sm text-muted">About {task.minutes} minutes</p>
                  </div>
                  <LinkButton href={task.href} size="sm">
                    Start
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card as="section" aria-labelledby="overall-title">
          <h2 id="overall-title" className="mb-3 text-base font-bold text-ink">
            Overall Progress
          </h2>
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} label={`${pct}% of available questions practised`} size={100}>
              <span className="text-xl font-bold text-ink">{pct}%</span>
            </ProgressRing>
            <div>
              <p className="text-sm text-muted">Questions practised</p>
              <p className="text-xl font-bold text-ink tabular-nums">
                {done} / {total}
              </p>
            </div>
          </div>
        </Card>
        <Card as="section" aria-labelledby="todo-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="todo-title" className="text-base font-bold text-ink">
              Today&apos;s Study
            </h2>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {doneToday.length} / {studyPlan.dailyTasks.length}
            </span>
          </div>
          <ul className="space-y-1">
            {studyPlan.dailyTasks.map((t) => {
              const isDone = doneToday.includes(t.id);
              return (
                <li key={t.id}>
                  <Link href={t.href} className="flex items-center gap-3 rounded-lg p-2 text-sm text-body hover:bg-surface-muted">
                    {isDone ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done today" /> : <Circle className="size-5 shrink-0 text-line-strong" aria-label="Not done yet" />}
                    <span className={cn(isDone && "text-muted line-through")}>{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Practice tasks are ticked automatically when you practise them today.</p>
        </Card>
        <TipCard title="Study Tip">
          <p>Try to practise a little every day. Consistent study is the best way to improve your TOEFL score.</p>
        </TipCard>
        <p className="text-xs text-muted">The weekly schedule follows simple, transparent rules based on your answers. The practice questions themselves are generated by AI.</p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Make a new plan?"
        description="You will answer the questions again. Your practice history stays the same."
        confirmLabel="Start new plan"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setEditing(true);
        }}
      />
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary" aria-hidden>
      {n}
    </span>
  );
}
