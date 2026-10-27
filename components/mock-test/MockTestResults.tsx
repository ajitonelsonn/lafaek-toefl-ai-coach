"use client";

import Link from "next/link";
import { ArrowRight, Clock, RotateCcw } from "lucide-react";
import { getSkill, practiceTypesForSkill, practiceHref } from "@/lib/config/practice-types";
import { formatDate, formatMinutes, percent } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { Icon3D } from "@/components/ui/Icon3D";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

export interface MockResultDTO {
  completedAt: string;
  durationSeconds: number;
  sections: { skill: "reading" | "listening" | "writing" | "speaking"; correct: number | null; total: number; answered: number; note?: string }[];
}

export function MockTestResults({ result }: { result: MockResultDTO | null }) {
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
  const pct = percent(correct, total);
  const weakest = [...graded].sort((a, b) => (a.correct ?? 0) / a.total - (b.correct ?? 0) / b.total)[0];

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="summary-title" className="bg-gradient-to-br from-primary-soft to-surface">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <ProgressRing value={pct} size={148} stroke={12} label={`${pct}% of auto-scored questions correct`}>
            <span className="text-3xl font-extrabold text-ink">{total ? `${pct}%` : "–"}</span>
            <span className="text-xs text-muted">correct</span>
          </ProgressRing>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <h2 id="summary-title" className="text-2xl font-extrabold text-ink">
                Practice estimate
              </h2>
              <StatusBadge tone="warning">Practice estimate</StatusBadge>
            </div>
            <p className="mt-2 text-body">
              You answered <span className="font-bold text-ink">{correct}</span> of {total} Reading and Listening questions correctly.
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted md:justify-start">
              <Clock className="size-4" aria-hidden /> {formatMinutes(result.durationSeconds / 60)} · {formatDate(result.completedAt)}
            </p>
            <p className="mt-3 text-xs text-muted">
              This is not an official or certified TOEFL score. It only reflects a short practice test.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
              <LinkButton href="/mock-test" variant="secondary" leftIcon={<RotateCcw className="size-4" />}>
                Take it again
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
        <CardHeader title={<span id="breakdown-title">Section breakdown</span>} description="Writing and Speaking need AI scoring, which is not connected yet." />
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {result.sections.map((s) => {
            const tone = SKILL_TONE[s.skill];
            const p = s.correct !== null ? percent(s.correct, s.total) : null;
            const firstType = practiceTypesForSkill(s.skill)[0];
            return (
              <li key={s.skill} className={cn("flex flex-col gap-3 rounded-xl border p-4", tone.border, tone.soft)}>
                <div className="flex items-center gap-3">
                  <SkillIconTile skill={s.skill} className="bg-surface" />
                  <div>
                    <p className={cn("font-bold", tone.text)}>{getSkill(s.skill).title}</p>
                    <p className="text-sm font-semibold text-ink">{s.correct !== null ? `${s.correct} / ${s.total} correct` : `${s.answered} / ${s.total} answered`}</p>
                  </div>
                </div>
                {p !== null ? <ProgressBar value={p} tone={tone.tone} label={`${getSkill(s.skill).title} accuracy`} showValue /> : <StatusBadge>Not auto-scored</StatusBadge>}
                {s.note && <p className="text-sm text-body">{s.note}</p>}
                <Link href={practiceHref(firstType.slug)} className="mt-auto text-sm font-semibold text-primary hover:underline">
                  Practise {firstType.title} →
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
