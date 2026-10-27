"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, Check, Clock, History, Sparkles, Target } from "lucide-react";
import { PRACTICE_TYPES, SKILLS, getPracticeType, practiceHref, type PracticeType } from "@/lib/config/practice-types";
import { BRAND } from "@/lib/config/assets";
import { sampleCount } from "@/lib/mock-data/questions";
import { todayKey, useDemoState, useHydrated } from "@/lib/store/demo-store";
import { formatRelative, percent } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { Icon3D } from "@/components/ui/Icon3D";
import { GenerationProgress } from "@/components/generation/GenerationProgress";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekDates(now = new Date()): string[] {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return WEEKDAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return todayKey(d);
  });
}

export function Dashboard() {
  const hydrated = useHydrated();
  const { user, studyPlan, attempts, completedUnits, dailyDone } = useDemoState();

  const recommended: PracticeType[] = useMemo(() => {
    const notDone = PRACTICE_TYPES.filter((t) => (completedUnits[t.slug]?.length ?? 0) < sampleCount(t.slug));
    const weak = studyPlan?.input.weakAreas ?? [];
    const ranked = [...notDone.filter((t) => weak.includes(t.skill)), ...notDone.filter((t) => !weak.includes(t.skill))];
    return (ranked.length ? ranked : [...PRACTICE_TYPES]).slice(0, 3);
  }, [completedUnits, studyPlan]);

  const next = recommended[0];
  const week = weekDates();
  const today = todayKey();
  const practisedDays = new Set(attempts.map((a) => todayKey(new Date(a.completedAt))));
  const dailyTotal = studyPlan?.dailyTasks.length ?? 0;
  const dailyCount = dailyDone[today]?.length ?? 0;

  const totals = SKILLS.map((skill) => {
    const types = PRACTICE_TYPES.filter((t) => t.skill === skill.id);
    const done = types.reduce((s, t) => s + Math.min(sampleCount(t.slug), completedUnits[t.slug]?.length ?? 0), 0);
    const total = types.reduce((s, t) => s + sampleCount(t.slug), 0);
    return { skill, types, done, total };
  });
  const overallDone = totals.reduce((s, t) => s + t.done, 0);
  const overallTotal = totals.reduce((s, t) => s + t.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {hydrated && user ? `Welcome back, ${user.name}!` : "Welcome!"}
        </h1>
        <p className="mt-1.5 text-base text-muted sm:text-lg">Keep practising and get closer to your TOEFL goals.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section aria-label="Next step" className="grid items-end gap-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-gradient-to-br from-primary-soft via-surface to-surface p-6 shadow-card sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:p-8 sm:pb-0">
          <div className="self-center sm:pb-8">
            <h2 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
              Your TOEFL Journey <span className="block text-primary">with AI Coach</span>
            </h2>
            <p className="mt-3 text-base text-body">
              Practise all four skills with sample questions today. Personalised questions and AI feedback will join when the AI service is connected.
            </p>
            <LinkButton href={next ? practiceHref(next.slug) : "/practice"} size="lg" className="mt-6" rightIcon={<ArrowRight className="size-4" />}>
              {attempts.length ? `Continue: ${next?.shortTitle ?? "Practice"}` : "Start Practising Now"}
            </LinkButton>
          </div>
          <div className="hidden flex-col items-center sm:flex">
            <p className="mb-2 rotate-[-3deg] rounded-xl bg-surface/90 px-3 py-2 text-center text-sm font-semibold italic text-primary shadow-sm">
              Small steps every day lead to a big score!
            </p>
            <Image src={BRAND.mark.src} alt="" width={300} height={237} className="pointer-events-none h-auto w-full max-w-[300px]" priority />
          </div>
        </section>

        <Card as="section" aria-labelledby="plan-title">
          <CardHeader
            title={<span id="plan-title">Your Study Plan</span>}
            description={studyPlan ? "Based on your goals" : "Get a weekly plan in about 2 minutes"}
            icon={<Icon3D name="goal" size={40} />}
            action={
              <Link href="/study-plan" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                {studyPlan ? "View plan" : "Create plan"} <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          {!hydrated ? (
            <Skeleton className="h-24" />
          ) : studyPlan ? (
            <div className="rounded-xl border border-line bg-surface-soft p-3">
              <p className="flex items-center gap-2 text-sm text-muted">
                <Target className="size-4 text-success" aria-hidden /> Current goal
              </p>
              <p className="font-bold text-ink">
                Score {studyPlan.input.targetScore} in {studyPlan.totalWeeks} weeks
              </p>
              <p className="mt-1 text-sm text-body">
                Today: {dailyCount} of {dailyTotal} tasks done · {studyPlan.input.dailyMinutes} min a day
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-start rounded-xl border border-dashed border-line-strong bg-surface-soft p-4 text-sm text-body">
              <p>Tell us your level, target score and study time. We will suggest which practice types to do each week.</p>
              <LinkButton href="/study-plan" size="sm" className="mt-3" variant="soft">
                Create my study plan
              </LinkButton>
            </div>
          )}
          <p className="mb-2 mt-5 text-sm font-bold text-ink">This week</p>
          <ol className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d, i) => {
              const done = hydrated && practisedDays.has(week[i]);
              const isToday = week[i] === today;
              return (
                <li key={d} className="flex flex-col items-center gap-1.5">
                  <span className={cn("text-xs", isToday ? "font-bold text-primary" : "text-muted")}>{d}</span>
                  <span
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full border-2",
                      done ? "border-primary bg-primary text-on-primary" : isToday ? "border-primary bg-primary-soft" : "border-line-strong",
                    )}
                    aria-label={`${d}: ${done ? "practised" : "no practice yet"}`}
                  >
                    {done && <Check className="size-4" aria-hidden />}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <Card as="section" aria-labelledby="overall-title">
        <CardHeader
          title={<span id="overall-title">Your Practice So Far</span>}
          description="Sample questions you have completed in this browser, by skill."
          icon={<Icon3D name="analytics" size={40} />}
          action={
            <div className="w-full min-w-48 sm:w-64">
              <p className="mb-1 text-right text-sm font-semibold text-ink tabular-nums">
                {overallDone} / {overallTotal} questions
              </p>
              <ProgressBar value={overallDone} max={overallTotal} label="Overall sample progress" />
            </div>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {totals.map(({ skill, types, done, total }) => {
            const tone = SKILL_TONE[skill.id];
            return (
              <Link key={skill.id} href={`/practice?skill=${skill.id}`} className={cn("group rounded-xl border p-4 transition-colors hover:border-primary", tone.border, tone.soft)}>
                <div className="flex items-center gap-3">
                  <SkillIconTile skill={skill.id} className="bg-surface" />
                  <div className="flex-1">
                    <p className="font-bold text-ink">{skill.title}</p>
                    <p className="text-sm font-semibold text-body tabular-nums">
                      {done}/{total}
                    </p>
                  </div>
                  <ArrowRight className={cn("size-5", tone.text)} aria-hidden />
                </div>
                <ProgressBar value={done} max={total} tone={tone.tone} label={`${skill.title} progress`} className="mt-3" size="sm" />
                <ul className="mt-3 space-y-1 text-sm">
                  {types.map((t) => (
                    <li key={t.slug} className="flex justify-between gap-2 text-body">
                      <span className="truncate">{t.shortTitle}</span>
                      <span className="tabular-nums">
                        {Math.min(sampleCount(t.slug), completedUnits[t.slug]?.length ?? 0)}/{sampleCount(t.slug)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card as="section" aria-labelledby="rec-title">
          <CardHeader
            title={<span id="rec-title">Recommended for You</span>}
            description={studyPlan ? "Based on your study plan and practice" : "Good places to start"}
            icon={<Sparkles className="size-7 text-primary" aria-hidden />}
            action={
              <Link href="/practice" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <ul className="grid gap-4 md:grid-cols-3">
            {recommended.map((t) => (
              <li key={t.slug} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                <div className="flex items-center gap-3">
                  <SkillIconTile skill={t.skill} slug={t.slug} />
                  <div className="min-w-0">
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", SKILL_TONE[t.skill].text)}>{t.skill}</p>
                    <p className="font-bold leading-snug text-ink">{t.title}</p>
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Clock className="size-4" aria-hidden /> {sampleCount(t.slug)} sample questions · ~{Math.round(t.timeLimitSeconds / 60)} min
                </p>
                <LinkButton href={practiceHref(t.slug)} size="sm" className="mt-auto">
                  Start Practice
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" aria-labelledby="activity-title">
          <CardHeader
            title={<span id="activity-title">Recent Activity</span>}
            icon={<History className="size-7 text-primary" aria-hidden />}
            action={
              attempts.length > 0 && (
                <Link href="/progress" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  View all <ArrowRight className="size-4" aria-hidden />
                </Link>
              )
            }
          />
          {!hydrated ? (
            <Skeleton className="h-32" />
          ) : attempts.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-7" />}
              title="No practice yet"
              description="Your finished practice sets will appear here."
              action={<LinkButton href="/practice" size="sm">Go to Practice Center</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {attempts.slice(0, 4).map((a) => {
                const t = getPracticeType(a.slug)!;
                const score = a.correct !== null ? percent(a.correct, a.total) : null;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <SkillIconTile skill={t.skill} slug={t.slug} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                      <p className="text-xs text-muted">
                        {a.correct !== null ? `Score: ${a.correct}/${a.total}` : `${a.answered}/${a.total} completed`} · {formatRelative(a.completedAt)}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", score === null ? "bg-primary-soft text-primary" : score >= 70 ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                      {score === null ? "Done" : `${score}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card as="section" aria-labelledby="generation-title" id="generation" className="scroll-mt-24">
        <CardHeader
          title={<span id="generation-title">Practice Content Status</span>}
          description="Sample questions for all 12 task types are ready. Personalised sets appear here as they become available."
          icon={<Icon3D name="ai-coach" size={40} />}
        />
        {hydrated ? <GenerationProgress /> : <Skeleton className="h-24" />}
      </Card>
    </div>
  );
}
