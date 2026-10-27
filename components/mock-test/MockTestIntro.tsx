"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock, FileText, Lightbulb, ListChecks, Play, TrendingUp } from "lucide-react";
import { SKILLS, practiceTypesForSkill, referenceTotalForSkill, type SkillId } from "@/lib/config/practice-types";
import { MOCK_DEMO_MINUTES, MOCK_FULL_MINUTES, itemsForSections } from "@/lib/mock-data/mock-test";
import { useDemoState, useHydrated } from "@/lib/store/demo-store";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { TipCard, InfoCallout } from "@/components/ui/Callouts";
import { DemoBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { percent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function MockTestIntro() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { mockResult } = useDemoState();
  const [sections, setSections] = useState<SkillId[]>(SKILLS.map((s) => s.id));
  const [error, setError] = useState("");

  const items = itemsForSections(sections);
  const minutes = sections.reduce((n, s) => n + MOCK_DEMO_MINUTES[s], 0);
  const fullMinutes = Object.values(MOCK_FULL_MINUTES).reduce((a, b) => a + b, 0);

  const graded = mockResult?.sections.filter((s) => s.correct !== null) ?? [];
  const best = graded.length ? percent(graded.reduce((n, s) => n + (s.correct ?? 0), 0), graded.reduce((n, s) => n + s.total, 0)) : null;

  const toggle = (id: SkillId) => {
    setError("");
    setSections((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  };

  const start = () => {
    if (!sections.length) {
      setError("Choose at least one section.");
      return;
    }
    router.push(`/mock-test/session?sections=${sections.join(",")}`);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <InfoCallout title="About the Mock Test">
          The full practice test will follow the TOEFL 2026 format with all 12 task types. While the question bank is being built, you can take a
          short demo test made from sample questions. Results are practice estimates, not official TOEFL scores.
        </InfoCallout>

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {[
            { icon: Clock, title: `About ${Math.round(fullMinutes / 60)} hours`, body: "Planned full test length" },
            { icon: FileText, title: "Realistic format", body: "All 12 question types" },
            { icon: TrendingUp, title: "Section results", body: "See accuracy by skill" },
            { icon: Lightbulb, title: "Improve faster", body: "Find your weak areas" },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
              <Icon className="size-7 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-bold text-ink">{title}</p>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <Card as="section" aria-labelledby="sections-title">
          <CardHeader
            title={<span id="sections-title">Test Sections</span>}
            description="Choose the sections for your demo test."
            icon={<ListChecks className="size-7 text-primary" aria-hidden />}
            action={<StatusBadge tone="primary">Full test: about {Math.round(fullMinutes / 60)} hours (planned)</StatusBadge>}
          />
          <fieldset>
            <legend className="sr-only">Sections to include</legend>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {SKILLS.map((s) => {
                const on = sections.includes(s.id);
                const tone = SKILL_TONE[s.id];
                const types = practiceTypesForSkill(s.id);
                return (
                  <label key={s.id} className={cn("flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/40", on ? cn(tone.soft, "border-primary") : "border-line bg-surface opacity-75")}>
                    <span className="flex items-start gap-3">
                      <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-1 size-4 accent-[var(--primary)]" />
                      <SkillIconTile skill={s.id} size="sm" className="bg-surface" />
                      <span>
                        <span className={cn("block text-lg font-bold", tone.text)}>{s.title}</span>
                        <span className="text-xs text-muted">
                          {types.length} task types · ~{MOCK_FULL_MINUTES[s.id]} min (full)
                        </span>
                      </span>
                    </span>
                    <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                      {types.map((t) => (
                        <li key={t.slug} className="flex items-center justify-between gap-2 text-body">
                          <span>{t.title}</span>
                          <span className="rounded-full bg-surface px-2 text-xs font-semibold text-ink">{t.referenceCount}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="mt-3 rounded-lg bg-surface/80 px-3 py-2 text-sm font-semibold text-ink">
                      Planned: {referenceTotalForSkill(s.id)} questions · Demo: {itemsForSections([s.id]).length}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <section aria-label="Start" className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-primary-soft/50 p-6 text-center">
          <p className="text-sm text-body">
            Demo test: <span className="font-bold text-ink">{items.length} questions</span> · about <span className="font-bold text-ink">{minutes} minutes</span>
          </p>
          <Button size="lg" className="h-14 px-8 text-lg" leftIcon={<Play className="size-5" />} onClick={start}>
            Start Mock Test
          </Button>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <p className="text-sm text-muted">Are you ready? Let&apos;s see how much you have improved!</p>
        </section>
      </div>

      <aside className="flex flex-col gap-5" aria-label="Mock test summary">
        <Card as="section" aria-labelledby="best-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="best-title" className="text-base font-bold text-ink">
              Latest Mock Test
            </h2>
            <DemoBadge>Estimate</DemoBadge>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={best ?? 0} size={96} label={best === null ? "Not taken yet" : `${best}% correct`}>
              <span className="text-lg font-bold text-ink">{hydrated && best !== null ? `${best}%` : "–"}</span>
            </ProgressRing>
            <div>
              <p className="text-sm text-muted">{hydrated && best !== null ? "Correct answers" : "Not taken yet"}</p>
              {hydrated && best !== null && (
                <Link href="/mock-test/results" className="text-sm font-semibold text-primary hover:underline">
                  View results
                </Link>
              )}
            </div>
          </div>
        </Card>
        <Card as="section" aria-labelledby="cond-title">
          <h2 id="cond-title" className="mb-3 text-base font-bold text-ink">
            Test Conditions
          </h2>
          <ul className="space-y-2.5 text-sm text-body">
            {["Quiet environment", "Working microphone (for Speaking)", "Use a computer or tablet", "Follow the time limits", "Try to finish in one sitting"].map((c) => (
              <li key={c} className="flex items-center gap-2">
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </Card>
        <TipCard>
          <p>Take a mock test after you have practised each section at least once. This gives you the most useful result.</p>
        </TipCard>
      </aside>
    </div>
  );
}
