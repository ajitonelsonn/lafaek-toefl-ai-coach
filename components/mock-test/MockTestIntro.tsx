"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock, History, ListChecks, Play, Sparkles, Ticket, Timer, TrendingUp } from "lucide-react";
import { SKILLS, getPracticeType, type SkillId } from "@/lib/config/practice-types";
import { MOCK_BLUEPRINT, MOCK_DEMO_MINUTES, mockQuestionCount } from "@/lib/config/mock-test";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import { CERTIFICATE_MIN_BAND, verifyPath } from "@/lib/config/certificate";
import { Icon3D } from "@/components/ui/Icon3D";
import type { MockResultDTO } from "@/lib/practice/mock-dto";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressBar";
import { TipCard, InfoCallout } from "@/components/ui/Callouts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { percent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { BOOST_PACK } from "@/lib/config/pricing";
import { useToast } from "@/components/ui/Toast";
import { UpgradeDialog } from "@/components/upgrade/UpgradeDialog";
import { MockTestPreparing } from "./MockTestPreparing";

/** How to earn a certificate, with a link to the preview (or to the certificate the latest test earned). */
function CertificateCard({ code }: { code: string | null }) {
  return (
    <Card as="section" aria-labelledby="cert-title" className="border-[#e6c768] bg-gradient-to-br from-[#fff8e1] to-surface">
      <div className="flex items-start gap-3">
        <Icon3D name="achievement" size={44} />
        <div className="min-w-0">
          <h2 id="cert-title" className="text-base font-bold text-ink">
            Earn a certificate
          </h2>
          <p className="mt-1 text-sm text-body">Score {formatBand(CERTIFICATE_MIN_BAND)} or higher on a full mock test to get a certificate that anyone can verify online.</p>
          <Link href={code ? verifyPath(code) : "/mock-test/certificate-preview"} className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
            {code ? "View your certificate" : "Preview certificate"} →
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function MockTestIntro({ latest, active, credits }: { latest: MockResultDTO | null; active: { startedAt: string; expiresAt: string } | null; credits: { planCredits: number; mockCredits: number } }) {
  const router = useRouter();
  const toast = useToast();
  const [sections, setSections] = useState<SkillId[]>(SKILLS.map((s) => s.id));
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const canStart = credits.mockCredits > 0;

  const questions = sections.reduce((n, s) => n + mockQuestionCount(s), 0);
  const minutes = sections.reduce((n, s) => n + MOCK_DEMO_MINUTES[s], 0);
  const band = latest?.estimatedBand ?? null;
  const graded = latest?.sections.filter((s) => s.correct !== null) ?? [];
  const accuracy = graded.length ? percent(graded.reduce((n, s) => n + (s.correct ?? 0), 0), graded.reduce((n, s) => n + s.total, 0)) : null;

  const toggle = (id: SkillId) => {
    setError("");
    setSections((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  };

  /** Uses one mock-test credit and opens the session (the preparing animation covers the wait). */
  const start = async () => {
    if (!sections.length) {
      setError("Choose at least one section.");
      return;
    }
    if (!canStart) {
      setUpgradeOpen(true);
      return;
    }
    setStarting(true);
    try {
      await api("/api/mock-test/start", { body: { sections } });
      router.push("/mock-test/session");
    } catch (e) {
      setStarting(false);
      if (e instanceof ApiClientError && e.code === "UPGRADE_REQUIRED") setUpgradeOpen(true);
      else toast(errorMessage(e), "warning");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {active && (
          <section aria-label="Unfinished mock test" className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border-2 border-primary bg-primary-soft/60 p-4">
            <History className="size-8 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">You have a mock test in progress</p>
              <p className="text-sm text-body">Continue where you stopped. It does not use another mock test. Unfinished tests expire 8 hours after they start.</p>
            </div>
            <Button rightIcon={<ArrowRight className="size-4" />} onClick={() => { setStarting(true); router.push("/mock-test/session"); }}>
              Continue test
            </Button>
          </section>
        )}

        <InfoCallout title="About the Mock Test">
          Every mock test is new: it uses your own personalised questions that you have not seen in a mock test before (starter questions fill any
          gaps). Each section has its own timer, like the real test. Every section gets a band on the 1–6 scale: Reading and Listening
          are scored from your answers, and Writing and Speaking are rated by AI about a minute after you submit. Your overall band is their
          average. Results are practice estimates, not official TOEFL scores.
        </InfoCallout>

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {[
            { icon: Sparkles, title: "New every time", body: "From your personalised questions" },
            { icon: Timer, title: "Section timers", body: "Each section is timed" },
            { icon: TrendingUp, title: "Estimated band", body: "1–6 scale for Reading and Listening" },
            { icon: Clock, title: "Track progress", body: "History of all your mock tests" },
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
            description="Choose the sections for your mock test."
            icon={<ListChecks className="size-7 text-primary" aria-hidden />}
            action={<StatusBadge tone="primary">Short practice test</StatusBadge>}
          />
          <fieldset>
            <legend className="sr-only">Sections to include</legend>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {SKILLS.map((s) => {
                const on = sections.includes(s.id);
                const tone = SKILL_TONE[s.id];
                const parts = MOCK_BLUEPRINT[s.id];
                return (
                  <label key={s.id} className={cn("flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/40", on ? cn(tone.soft, "border-primary") : "border-line bg-surface opacity-75")}>
                    <span className="flex items-start gap-3">
                      <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-1 size-4 accent-[var(--primary)]" />
                      <SkillIconTile skill={s.id} size="sm" className="bg-surface" />
                      <span>
                        <span className={cn("block text-lg font-bold", tone.text)}>{s.title}</span>
                        <span className="text-xs text-muted">
                          {mockQuestionCount(s.id)} questions · {MOCK_DEMO_MINUTES[s.id]} min
                        </span>
                      </span>
                    </span>
                    <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                      {parts.map((p) => (
                        <li key={p.slug} className="flex items-center justify-between gap-2 text-body">
                          <span>{getPracticeType(p.slug)?.title}</span>
                          <span className="rounded-full bg-surface px-2 text-xs font-semibold text-ink">{p.items * p.unitsPerItem}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="mt-3 rounded-lg bg-surface/80 px-3 py-2 text-sm font-semibold text-ink">
                      {s.id === "reading" || s.id === "listening" ? "Scored automatically · band estimate" : "Rated by AI · band estimate"}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <section aria-label="Start" className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-primary-soft/50 p-6 text-center">
          <p className="text-sm text-body">
            Practice test: <span className="font-bold text-ink">{questions} questions</span> · about <span className="font-bold text-ink">{minutes} minutes</span> ·{" "}
            {sections.length} {sections.length === 1 ? "section" : "sections"}, each timed
          </p>
          {canStart ? (
            <Button size="lg" className="h-14 px-8 text-lg" leftIcon={<Play className="size-5" />} onClick={() => void start()} loading={starting}>
              Start Mock Test
            </Button>
          ) : (
            <Button size="lg" className="h-14 px-8 text-lg" leftIcon={<Sparkles className="size-5" />} onClick={() => setUpgradeOpen(true)}>
              Upgrade · ${BOOST_PACK.priceUsd} for 2 more tests
            </Button>
          )}
          <p className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-ink ring-1 ring-line">
            <Ticket className="size-4 text-primary" aria-hidden /> Mock tests left: {credits.mockCredits}
          </p>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <p className="text-sm text-muted">
            {canStart ? "Starting uses 1 mock test. Are you ready? Let's see how much you have improved!" : `Your free Starter mock test is used. A ${BOOST_PACK.name} adds 2 more.`}
          </p>
        </section>
      </div>

      <aside className="flex flex-col gap-5" aria-label="Mock test summary">
        <Card as="section" aria-labelledby="best-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="best-title" className="text-base font-bold text-ink">
              Latest Mock Test
            </h2>
            <StatusBadge tone="warning">Estimate</StatusBadge>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={band !== null ? (band / 6) * 100 : (accuracy ?? 0)} size={96} label={band !== null ? `Estimated band ${formatBand(band)} of 6` : latest ? `${accuracy ?? 0}% correct` : "Not taken yet"}>
              <span className="text-lg font-bold text-ink">{band !== null ? formatBand(band) : accuracy !== null ? `${accuracy}%` : "–"}</span>
            </ProgressRing>
            <div>
              <p className="text-sm text-muted">{band !== null ? `Estimated band · of 6 · ${cefrForBand(band)}` : latest ? "Correct answers" : "Not taken yet"}</p>
              {latest && (
                <Link href="/mock-test/results" className="text-sm font-semibold text-primary hover:underline">
                  View results
                </Link>
              )}
            </div>
          </div>
        </Card>
        <CertificateCard code={latest?.certificateCode ?? null} />
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
      {starting && <MockTestPreparing overlay />}
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="mock" credits={credits} />
    </div>
  );
}
