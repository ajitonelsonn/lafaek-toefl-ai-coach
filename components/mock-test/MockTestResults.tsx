"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import { getSkill, practiceTypesForSkill, practiceHref, type SkillId } from "@/lib/config/practice-types";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import type { MockResultDTO } from "@/lib/practice/mock-dto";
import { formatDate, formatMinutes, percent } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { Icon3D } from "@/components/ui/Icon3D";
import { LineChart } from "@/components/charts/Charts";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

export type { MockResultDTO };

const bandOf = (r: MockResultDTO, skill: SkillId) => r.sections.find((s) => s.skill === skill)?.band ?? null;

export function MockTestResults({ history }: { history: MockResultDTO[] }) {
  const result = history[0];
  if (!result) {
    return (
      <EmptyState
        icon={<Icon3D name="practice-test" size={48} />}
        title="No mock test results yet"
        description="Take a mock test to see your results here."
        action={<LinkButton href="/mock-test">Take the Mock Test</LinkButton>}
      />
    );
  }

  const graded = result.sections.filter((s) => s.correct !== null);
  const correct = graded.reduce((n, s) => n + (s.correct ?? 0), 0);
  const total = graded.reduce((n, s) => n + s.total, 0);
  const band = result.estimatedBand;
  const weakest = [...graded].sort((a, b) => (a.correct ?? 0) / a.total - (b.correct ?? 0) / b.total)[0];
  const trend = [...history].reverse().filter((r) => r.estimatedBand !== null);

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="summary-title" className="bg-gradient-to-br from-primary-soft to-surface">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <ProgressRing value={band !== null ? (band / 6) * 100 : 0} size={148} stroke={12} label={band !== null ? `Estimated band ${formatBand(band)} of 6` : "No estimate"}>
            <span className="text-3xl font-extrabold text-ink">{band !== null ? formatBand(band) : "–"}</span>
            <span className="text-xs text-muted">{band !== null ? `of 6 · ${cefrForBand(band)}` : "no estimate"}</span>
          </ProgressRing>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <h2 id="summary-title" className="text-2xl font-extrabold text-ink">
                Estimated band
              </h2>
              <StatusBadge tone="warning">Practice estimate</StatusBadge>
              {result.personalised > 0 && <StatusBadge tone="primary">From your personalised questions</StatusBadge>}
            </div>
            <p className="mt-2 text-body">
              {total ? (
                <>
                  You answered <span className="font-bold text-ink">{correct}</span> of {total} Reading and Listening questions correctly ({percent(correct, total)}%).
                </>
              ) : (
                "This test had no auto-scored sections."
              )}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted md:justify-start">
              <Clock className="size-4" aria-hidden /> {formatMinutes(result.durationSeconds / 60)} · {formatDate(result.completedAt)}
            </p>
            <p className="mt-3 text-xs text-muted">
              A rough estimate on the TOEFL 2026 scale (1–6) from a short practice test, based on Reading and Listening only. It is not an official or certified TOEFL score.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
              <LinkButton href="/mock-test" variant="secondary" leftIcon={<RotateCcw className="size-4" />}>
                Take another mock test
              </LinkButton>
              {weakest && (
                <LinkButton href={`/practice?skill=${weakest.skill}`} rightIcon={<ArrowRight className="size-4" />}>
                  Practise {getSkill(weakest.skill).title}
                </LinkButton>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card as="section" aria-labelledby="breakdown-title">
        <CardHeader title={<span id="breakdown-title">Section breakdown</span>} description="Reading and Listening are scored automatically. Writing gets length and structure checks; Speaking is recorded for practice." />
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {result.sections.map((s) => {
            const tone = SKILL_TONE[s.skill];
            const p = s.correct !== null ? percent(s.correct, s.total) : null;
            const firstType = practiceTypesForSkill(s.skill)[0];
            return (
              <li key={s.skill} className={cn("flex flex-col gap-3 rounded-xl border p-4", tone.border, tone.soft)}>
                <div className="flex items-center gap-3">
                  <SkillIconTile skill={s.skill} className="bg-surface" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-bold", tone.text)}>{getSkill(s.skill).title}</p>
                    <p className="text-sm font-semibold text-ink">{s.correct !== null ? `${s.correct} / ${s.total} correct` : `${s.answered} / ${s.total} answered`}</p>
                  </div>
                  {s.band !== null && (
                    <span className="rounded-lg bg-surface px-2.5 py-1 text-center">
                      <span className="block text-lg font-extrabold leading-none text-ink">{formatBand(s.band)}</span>
                      <span className="text-[10px] font-semibold text-muted">of 6</span>
                    </span>
                  )}
                </div>
                {p !== null ? <ProgressBar value={p} tone={tone.tone} label={`${getSkill(s.skill).title} accuracy`} showValue /> : <StatusBadge className="self-start">Not auto-scored</StatusBadge>}
                {s.note && <p className="text-sm text-body">{s.note}</p>}
                {s.checks && (
                  <ul className="space-y-1 text-sm">
                    {s.checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-1.5 text-body">
                        {c.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Passed" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Not yet" />}
                        <span>
                          <span className="font-semibold text-ink">{c.label}:</span> {c.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={practiceHref(firstType.slug)} className="mt-auto text-sm font-semibold text-primary hover:underline">
                  Practise {firstType.title} →
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card as="section" aria-labelledby="history-title">
        <CardHeader title={<span id="history-title">Your mock tests</span>} description={history.length > 1 ? "Your estimated band over time. Each test uses new questions." : "Take more mock tests to see your progress over time."} />
        {trend.length > 1 && (
          <div className="mb-5">
            <LineChart
              title="Estimated band per mock test"
              data={trend.map((r) => ({ label: formatDate(r.completedAt), value: r.estimatedBand! }))}
              max={6}
              ticks={[0, 1, 2, 3, 4, 5, 6]}
              formatValue={(v) => formatBand(v)}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-4 font-semibold">Date</th>
                <th className="py-2 pr-4 font-semibold">Reading</th>
                <th className="py-2 pr-4 font-semibold">Listening</th>
                <th className="py-2 pr-4 font-semibold">Estimate</th>
                <th className="py-2 pr-4 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={r.id} className={cn("border-b border-line/70", i === 0 && "font-semibold")}>
                  <td className="py-2.5 pr-4 text-ink">{formatDate(r.completedAt)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{bandOf(r, "reading") !== null ? formatBand(bandOf(r, "reading")!) : "–"}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{bandOf(r, "listening") !== null ? formatBand(bandOf(r, "listening")!) : "–"}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-ink">{r.estimatedBand !== null ? `${formatBand(r.estimatedBand)} of 6` : "–"}</td>
                  <td className="py-2.5 pr-4 text-muted">{formatMinutes(r.durationSeconds / 60)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
