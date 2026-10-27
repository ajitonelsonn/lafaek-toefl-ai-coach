"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChartLine, Eye, EyeOff, ListChecks, Target } from "lucide-react";
import { PRACTICE_TYPES, SKILLS, getPracticeType, practiceHref, type PracticeSlug } from "@/lib/config/practice-types";
import { sampleCount } from "@/lib/mock-data/questions";
import { BACKGROUNDS } from "@/lib/config/assets";
import { useDemoState, useHydrated, type PracticeAttempt } from "@/lib/store/demo-store";
import { formatDate, formatMinutes, percent } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DemoBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { TipCard } from "@/components/ui/Callouts";
import { Icon3D } from "@/components/ui/Icon3D";
import { BarList, LineChart } from "@/components/charts/Charts";
import { SkillIconTile } from "@/components/practice/icons";

/** DEMO DATA used only when the learner chooses "Preview with sample data". */
const SAMPLE_ATTEMPTS: PracticeAttempt[] = (
  [
    ["complete-the-words", 14, 20, 20, 300],
    ["read-in-daily-life", 5, 7, 7, 420],
    ["listen-choose-response", 4, 6, 6, 150],
    ["build-sentence", 3, 5, 5, 360],
    ["read-academic-passage", 3, 5, 5, 600],
    ["listen-conversation", 4, 6, 6, 400],
    ["build-sentence", 5, 5, 5, 280],
    ["listen-announcement", 4, 5, 5, 310],
    ["write-email", null, 2, 2, 840],
    ["read-in-daily-life", 6, 7, 7, 380],
  ] as [PracticeSlug, number | null, number, number, number][]
)
  .map(([slug, correct, answered, total, durationSeconds], i) => ({
    id: `sample-${i}`,
    slug,
    correct,
    answered,
    total,
    durationSeconds,
    completedAt: new Date(Date.UTC(2026, 9, 14 + i, 9, 0)).toISOString(),
  }))
  .reverse();

const SAMPLE_UNITS: Partial<Record<PracticeSlug, number>> = {
  "complete-the-words": 2,
  "read-in-daily-life": 7,
  "read-academic-passage": 5,
  "listen-choose-response": 6,
  "listen-conversation": 6,
  "listen-announcement": 5,
  "build-sentence": 5,
  "write-email": 2,
};

export function ProgressPage() {
  const hydrated = useHydrated();
  const { attempts: realAttempts, completedUnits, studyPlan } = useDemoState();
  const [preview, setPreview] = useState(false);

  const usingSample = preview && realAttempts.length === 0;
  const attempts = usingSample ? SAMPLE_ATTEMPTS : realAttempts;
  const unitsDone = (slug: PracticeSlug) => Math.min(sampleCount(slug), usingSample ? (SAMPLE_UNITS[slug] ?? 0) : (completedUnits[slug]?.length ?? 0));

  const stats = useMemo(() => {
    const graded = attempts.filter((a) => a.correct !== null);
    const correct = graded.reduce((n, a) => n + (a.correct ?? 0), 0);
    const gradedTotal = graded.reduce((n, a) => n + a.total, 0);
    const answered = attempts.reduce((n, a) => n + a.answered, 0);
    const seconds = attempts.reduce((n, a) => n + a.durationSeconds, 0);
    const typesTried = new Set(attempts.map((a) => a.slug)).size;
    const trend = [...graded]
      .reverse()
      .slice(-10)
      .map((a) => ({
        label: new Date(a.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: percent(a.correct ?? 0, a.total),
        detail: getPracticeType(a.slug)?.title,
      }));
    const bySkill = SKILLS.map((s) => {
      const list = graded.filter((a) => getPracticeType(a.slug)?.skill === s.id);
      const c = list.reduce((n, a) => n + (a.correct ?? 0), 0);
      const t = list.reduce((n, a) => n + a.total, 0);
      return { skill: s, accuracy: t ? percent(c, t) : null, sets: attempts.filter((a) => getPracticeType(a.slug)?.skill === s.id).length };
    });
    return { accuracy: gradedTotal ? percent(correct, gradedTotal) : null, answered, seconds, typesTried, trend, bySkill };
  }, [attempts]);

  if (!hydrated) return <LoadingState label="Loading your progress…" />;

  if (!attempts.length) {
    return (
      <EmptyState
        icon={<Image src={BACKGROUNDS.progress.src} alt="" width={BACKGROUNDS.progress.width} height={BACKGROUNDS.progress.height} className="h-44 w-auto rounded-2xl" />}
        title="No progress yet"
        description="Finish a practice set and your accuracy, practice time, and activity will appear here. Everything is saved in this browser only."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/practice">Start practising</LinkButton>
            <Button variant="secondary" leftIcon={<Eye className="size-4" />} onClick={() => setPreview(true)}>
              Preview with sample data
            </Button>
          </div>
        }
        className="py-16"
      />
    );
  }

  const weakest = stats.bySkill.filter((s) => s.accuracy !== null).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))[0];
  const untried = SKILLS.filter((s) => !stats.bySkill.find((b) => b.skill.id === s.id)?.sets);

  return (
    <div className="flex flex-col gap-6">
      {usingSample && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
          <p className="flex items-center gap-2 text-sm text-body">
            <DemoBadge>Sample data</DemoBadge> You are looking at example progress, not your own results.
          </p>
          <Button size="sm" variant="secondary" leftIcon={<EyeOff className="size-4" />} onClick={() => setPreview(false)}>
            Hide sample data
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatTile icon="quiz" label="Questions practised" value={String(stats.answered)} sub={`${attempts.length} practice sets`} />
            <StatTile icon="success" label="Accuracy" value={stats.accuracy === null ? "–" : `${stats.accuracy}%`} sub="Auto-scored questions" />
            <StatTile icon="practice-test" label="Practice types tried" value={`${stats.typesTried} / 12`} sub={<ProgressBar value={stats.typesTried} max={12} label="Practice types tried" size="sm" />} />
            <StatTile icon="history" label="Practice time" value={formatMinutes(stats.seconds / 60)} sub="On practice pages" />
          </section>

          <div className="grid gap-6 2xl:grid-cols-2">
            <Card as="section" aria-labelledby="trend-title">
              <CardHeader title={<span id="trend-title">Accuracy over time</span>} description="Percent correct in each auto-scored practice set." icon={<ChartLine className="size-6 text-primary" aria-hidden />} />
              {stats.trend.length ? (
                <LineChart data={stats.trend} title={`Accuracy over your last ${stats.trend.length} scored practice sets`} />
              ) : (
                <p className="text-sm text-muted">Finish a Reading or Listening set to see your accuracy trend.</p>
              )}
            </Card>
            <Card as="section" aria-labelledby="skill-title">
              <CardHeader title={<span id="skill-title">Accuracy by skill</span>} description="Writing and Speaking are not auto-scored yet." icon={<Target className="size-6 text-primary" aria-hidden />} />
              <BarList
                rows={stats.bySkill.map((s) => ({ label: s.skill.title, value: s.accuracy ?? 0, detail: `${s.sets} practice sets` }))}
                formatValue={(v) => `${v}%`}
              />
              <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
                {stats.bySkill.map((s) => (
                  <li key={s.skill.id}>
                    {s.skill.title}: {s.accuracy === null ? (s.sets ? "not scored" : "not tried") : `${s.sets} sets`}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card as="section" aria-labelledby="types-title">
            <CardHeader title={<span id="types-title">Task-type progress</span>} description="Sample questions completed for each of the 12 practice types." icon={<ListChecks className="size-6 text-primary" aria-hidden />} />
            <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {PRACTICE_TYPES.map((t) => {
                const done = unitsDone(t.slug);
                const total = sampleCount(t.slug);
                return (
                  <li key={t.slug} className="flex items-center gap-3">
                    <SkillIconTile skill={t.skill} slug={t.slug} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <Link href={practiceHref(t.slug)} className="truncate font-semibold text-ink hover:text-primary">
                          {t.title}
                        </Link>
                        <span className="shrink-0 text-muted tabular-nums">
                          {done}/{total}
                        </span>
                      </div>
                      <ProgressBar value={done} max={total} tone={done === total ? "success" : "primary"} label={`${t.title} progress`} size="sm" className="mt-1" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="recent-title">
            <CardHeader title={<span id="recent-title">Recent practice activity</span>} />
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Recent practice sets</caption>
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Practice type</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Score</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Time</th>
                    <th scope="col" className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.slice(0, 10).map((a) => (
                    <tr key={a.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4 text-body">{formatDate(a.completedAt)}</td>
                      <td className="py-2.5 pr-4 font-semibold text-ink">{getPracticeType(a.slug)?.title}</td>
                      <td className="py-2.5 pr-4 font-semibold text-ink tabular-nums">{a.correct !== null ? `${a.correct} / ${a.total}` : "Not scored"}</td>
                      <td className="py-2.5 pr-4 text-body">{formatMinutes(a.durationSeconds / 60)}</td>
                      <td className="py-2.5">
                        <StatusBadge tone={a.answered === a.total ? "success" : "warning"}>{a.answered === a.total ? "Completed" : `${a.answered}/${a.total} answered`}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y divide-line md:hidden">
              {attempts.slice(0, 10).map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <p className="font-semibold text-ink">{getPracticeType(a.slug)?.title}</p>
                  <p className="text-muted">
                    {formatDate(a.completedAt)} · {a.correct !== null ? `${a.correct}/${a.total}` : "Not scored"} · {formatMinutes(a.durationSeconds / 60)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="flex flex-col gap-5" aria-label="Insights">
          <Card as="section" aria-labelledby="target-title">
            <h2 id="target-title" className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <Icon3D name="goal" size={28} /> Target Score
            </h2>
            {studyPlan ? (
              <>
                <p className="text-3xl font-extrabold text-ink">{studyPlan.input.targetScore}</p>
                <p className="text-sm text-muted">Goal from your study plan (0–120 scale). Practice accuracy is not converted to a TOEFL score.</p>
              </>
            ) : (
              <p className="text-sm text-body">
                No target yet.{" "}
                <Link href="/study-plan" className="font-semibold text-primary hover:underline">
                  Set one in your study plan
                </Link>
                .
              </p>
            )}
          </Card>
          <Card as="section" aria-labelledby="insight-title" className="bg-speaking-soft/50">
            <h2 id="insight-title" className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <Icon3D name="tips" size={26} /> Progress Insight
            </h2>
            <p className="text-sm text-body">
              You have tried <span className="font-bold text-ink">{stats.typesTried}</span> of 12 practice types.{" "}
              {weakest ? `Your lowest scored skill so far is ${weakest.skill.title}.` : "Finish a Reading or Listening set to see your strongest skill."}
            </p>
          </Card>
          <Card as="section" aria-labelledby="rec2-title">
            <h2 id="rec2-title" className="mb-3 text-base font-bold text-ink">
              Recommendations
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {weakest && (
                <li>
                  <Link href={`/practice?skill=${weakest.skill.id}`} className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                    More {weakest.skill.title} practice <ArrowRight className="size-4 text-primary" aria-hidden />
                  </Link>
                </li>
              )}
              {untried.slice(0, 2).map((s) => (
                <li key={s.id}>
                  <Link href={`/practice?skill=${s.id}`} className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                    Try {s.title} for the first time <ArrowRight className="size-4 text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/mock-test" className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                  Take a demo mock test <ArrowRight className="size-4 text-primary" aria-hidden />
                </Link>
              </li>
              <li>
                <Link href="/vocabulary" className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                  Review vocabulary <ArrowRight className="size-4 text-primary" aria-hidden />
                </Link>
              </li>
            </ul>
          </Card>
          <TipCard>
            <p>Consistent practice is the key to a higher TOEFL score. Try to practise a little every day!</p>
          </TipCard>
        </aside>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, sub }: { icon: Parameters<typeof Icon3D>[0]["name"]; label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft" aria-hidden>
        <Icon3D name={icon} size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
        <div className="mt-1 text-xs text-muted">{sub}</div>
      </div>
    </div>
  );
}
