"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChartLine, ListChecks, Target } from "lucide-react";
import { PRACTICE_TYPES, getPracticeType, getSkill, practiceHref } from "@/lib/config/practice-types";
import { BACKGROUNDS } from "@/lib/config/assets";
import type { ProgressDTO } from "@/lib/practice/insights-dto";
import { formatDate, formatMinutes } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { TipCard } from "@/components/ui/Callouts";
import { Icon3D } from "@/components/ui/Icon3D";
import { BarList, LineChart } from "@/components/charts/Charts";
import { SkillIconTile } from "@/components/practice/icons";

export function ProgressPage({ progress, targetScore }: { progress: ProgressDTO; targetScore: number | null }) {
  if (progress.questionsAttempted === 0) {
    return (
      <EmptyState
        icon={<Image src={BACKGROUNDS.progress.src} alt="" width={BACKGROUNDS.progress.width} height={BACKGROUNDS.progress.height} className="h-44 w-auto rounded-2xl" />}
        title="No progress yet"
        description="Answer some practice questions and your accuracy, practice time and activity will appear here."
        action={<LinkButton href="/practice">Start practising</LinkButton>}
        className="py-16"
      />
    );
  }

  const scored = progress.bySkill.filter((s) => s.accuracy !== null);
  const weakest = [...scored].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))[0];
  const untried = progress.bySkill.filter((s) => s.answered === 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <StatTile icon="quiz" label="Questions practised" value={String(progress.questionsAttempted)} sub={`${progress.objectiveAnswered} auto-scored`} />
          <StatTile icon="success" label="Accuracy" value={progress.accuracy === null ? "–" : `${progress.accuracy}%`} sub="Auto-scored questions" />
          <StatTile icon="practice-test" label="Practice types tried" value={`${progress.typesTried} / 12`} sub={<ProgressBar value={progress.typesTried} max={12} label="Practice types tried" size="sm" />} />
          <StatTile icon="history" label="Practice time" value={progress.practiceMinutes ? formatMinutes(progress.practiceMinutes) : "–"} sub="Measured on practice pages" />
        </section>

        <div className="grid gap-6 2xl:grid-cols-2">
          <Card as="section" aria-labelledby="trend-title">
            <CardHeader title={<span id="trend-title">Accuracy over time</span>} description="Percent correct on each day you practised." icon={<ChartLine className="size-6 text-primary" aria-hidden />} />
            {progress.trend.length ? (
              <LineChart
                data={progress.trend.map((t) => ({ label: new Date(`${t.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: t.accuracy, detail: `${t.answered} questions` }))}
                title={`Daily accuracy over ${progress.trend.length} practice days`}
              />
            ) : (
              <p className="text-sm text-muted">Answer some Reading or Listening questions to see your accuracy trend.</p>
            )}
          </Card>
          <Card as="section" aria-labelledby="skill-title">
            <CardHeader title={<span id="skill-title">Accuracy by skill</span>} description="Writing and Speaking are not auto-scored." icon={<Target className="size-6 text-primary" aria-hidden />} />
            <BarList rows={progress.bySkill.map((s) => ({ label: getSkill(s.skill).title, value: s.accuracy ?? 0, detail: `${s.answered} answered` }))} formatValue={(v) => `${v}%`} />
            <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
              {progress.bySkill.map((s) => (
                <li key={s.skill}>
                  {getSkill(s.skill).title}: {s.accuracy === null ? (s.answered ? `${s.answered} answered (not scored)` : "not tried") : `${s.answered} answered`}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card as="section" aria-labelledby="types-title">
          <CardHeader title={<span id="types-title">Task-type progress</span>} description="Questions answered out of those available to you in each practice type." icon={<ListChecks className="size-6 text-primary" aria-hidden />} />
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {PRACTICE_TYPES.map((t) => {
              const p = progress.byTask.find((b) => b.slug === t.slug);
              const total = p?.availableUnits ?? 0;
              const done = Math.min(total, p?.attemptedUnits ?? 0);
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
                    <ProgressBar value={done} max={Math.max(1, total)} tone={total && done === total ? "success" : "primary"} label={`${t.title} progress`} size="sm" className="mt-1" />
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
              <caption className="sr-only">Recent practice</caption>
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">Date</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Practice type</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Topic</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Score</th>
                  <th scope="col" className="py-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {progress.recent.map((a) => (
                  <tr key={`${a.slug}-${a.date}`} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 text-body">{formatDate(a.date)}</td>
                    <td className="py-2.5 pr-4 font-semibold text-ink">{getPracticeType(a.slug)?.title}</td>
                    <td className="py-2.5 pr-4 text-body">{a.topic}</td>
                    <td className="py-2.5 pr-4 font-semibold text-ink tabular-nums">{a.correct !== null ? `${a.correct} / ${a.total}` : <StatusBadge>Not auto-scored</StatusBadge>}</td>
                    <td className="py-2.5 text-body">{a.minutes ? formatMinutes(a.minutes) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y divide-line md:hidden">
            {progress.recent.map((a) => (
              <li key={`${a.slug}-${a.date}`} className="py-3 text-sm">
                <p className="font-semibold text-ink">{getPracticeType(a.slug)?.title}</p>
                <p className="text-muted">
                  {formatDate(a.date)} · {a.correct !== null ? `${a.correct}/${a.total}` : "Not auto-scored"}
                  {a.minutes ? ` · ${formatMinutes(a.minutes)}` : ""}
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
          {targetScore !== null ? (
            <>
              <p className="text-3xl font-extrabold text-ink">{targetScore}</p>
              <p className="text-sm text-muted">Goal from your study plan (0–120 scale). Practice accuracy is not converted into a TOEFL score.</p>
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
            You have tried <span className="font-bold text-ink">{progress.typesTried}</span> of 12 practice types.{" "}
            {weakest ? `Your lowest scored skill so far is ${getSkill(weakest.skill).title}.` : "Answer some Reading or Listening questions to see your strongest skill."}
          </p>
        </Card>
        <Card as="section" aria-labelledby="rec2-title">
          <h2 id="rec2-title" className="mb-3 text-base font-bold text-ink">
            Recommendations
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {weakest && (
              <li>
                <Link href={`/practice?skill=${weakest.skill}`} className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                  More {getSkill(weakest.skill).title} practice <ArrowRight className="size-4 text-primary" aria-hidden />
                </Link>
              </li>
            )}
            {untried.slice(0, 2).map((s) => (
              <li key={s.skill}>
                <Link href={`/practice?skill=${s.skill}`} className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                  Try {getSkill(s.skill).title} for the first time <ArrowRight className="size-4 text-primary" aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/mock-test" className="flex items-center justify-between gap-2 rounded-lg p-2 text-body hover:bg-surface-muted">
                Take a mock test <ArrowRight className="size-4 text-primary" aria-hidden />
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

