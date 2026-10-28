"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";
import { CERTIFICATE_MIN_BAND, certificateEligible, verifyPath } from "@/lib/config/certificate";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/components/ui/Toast";
import { LoadingWave } from "@/components/ui/MediaLoading";
import { getSkill, practiceTypesForSkill, practiceHref, type SkillId } from "@/lib/config/practice-types";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import type { MockResultDTO } from "@/lib/practice/mock-dto";
import { formatDate, formatMinutes, percent } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { Icon3D } from "@/components/ui/Icon3D";
import { LineChart } from "@/components/charts/Charts";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

export type { MockResultDTO };

const bandOf = (r: MockResultDTO, skill: SkillId) => r.sections.find((s) => s.skill === skill)?.band ?? null;
const SKILL_COLUMNS: SkillId[] = ["reading", "listening", "writing", "speaking"];

/** While Writing and Speaking are being rated (refreshes itself), or a retry when rating failed. */
function ScoringStatus({ result }: { result: MockResultDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pending = result.scoring === "pending";

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [pending, router]);

  const retry = async () => {
    setBusy(true);
    try {
      await api("/api/mock-test/rescore", { body: { resultId: result.id } });
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <Card as="section" aria-live="polite" className="flex flex-col items-center gap-4 border-primary/30 bg-primary-soft/60 text-center sm:flex-row sm:text-left">
        <Icon3D name="ai-coach" size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center justify-center gap-2 text-lg font-extrabold text-ink sm:justify-start">
            Rating your Writing and Speaking <LoadingWave className="text-primary" label="In progress" />
          </h2>
          <p className="mt-1 text-sm text-body">
            Our AI is transcribing your spoken answers and rating your email. This usually takes about a minute, and this page updates by itself. Your overall band and any
            certificate follow.
          </p>
        </div>
      </Card>
    );
  }
  if (result.scoring !== "failed") return null;
  return (
    <Card as="section" role="alert" className="flex flex-col items-center gap-4 border-warning/40 bg-warning-soft text-center sm:flex-row sm:text-left">
      <Icon3D name="warning" size={48} />
      <p className="min-w-0 flex-1 text-sm text-body">
        <span className="font-bold text-ink">Writing and Speaking could not be rated.</span> The AI service did not respond. Your answers are saved, so you can try again.
      </p>
      <Button loading={busy} onClick={() => void retry()} leftIcon={<RotateCcw className="size-4" />}>
        Try again
      </Button>
    </Card>
  );
}

/** The latest test's certificate: a link when issued, a button for an older qualifying test, or how to earn one. */
function CertificateCallout({ result }: { result: MockResultDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const eligible = certificateEligible(result);
  if (result.scoring === "pending" || result.scoring === "failed") return null;

  const claim = async () => {
    setBusy(true);
    try {
      const { code } = await api<{ code: string }>("/api/certificates", { body: { resultId: result.id } });
      router.push(verifyPath(code));
    } catch (e) {
      toast(errorMessage(e), "warning");
      setBusy(false);
    }
  };

  if (!result.certificateCode && !eligible) {
    return (
      <Card as="section" aria-label="Certificate" className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Icon3D name="achievement" size={48} className="opacity-70 grayscale" />
        <p className="flex-1 text-sm text-body">
          <span className="font-bold text-ink">Earn a verifiable certificate.</span> Score an estimated band of {formatBand(CERTIFICATE_MIN_BAND)} or higher on a full mock test (all
          four sections answered) and you get a certificate with an ID and QR code that anyone can check online.
        </p>
        <LinkButton href="/mock-test/certificate-preview" variant="secondary">
          Preview certificate
        </LinkButton>
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="certificate-title" className="flex flex-col items-center gap-5 border-[#e6c768] bg-gradient-to-r from-[#fff8e1] via-surface to-surface text-center sm:flex-row sm:text-left">
      <Icon3D name="achievement" size={72} />
      <div className="min-w-0 flex-1">
        <h2 id="certificate-title" className="text-xl font-extrabold text-ink">
          Congratulations, you earned a certificate!
        </h2>
        <p className="mt-1 text-sm text-body">
          Your estimated band of {formatBand(result.estimatedBand!)} ({cefrForBand(result.estimatedBand!)}) earns a LafaekTOEFL certificate. It has its own ID and QR code, so anyone
          can check it online. It shows your name and scores.
        </p>
      </div>
      {result.certificateCode ? (
        <LinkButton href={verifyPath(result.certificateCode)} size="lg" rightIcon={<ArrowRight className="size-4" />}>
          View certificate
        </LinkButton>
      ) : (
        <Button size="lg" loading={busy} onClick={() => void claim()}>
          Get your certificate
        </Button>
      )}
    </Card>
  );
}

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
  const rating = result.scoring === "pending";
  const weakest = result.sections.filter((s) => s.band !== null).sort((a, b) => a.band! - b.band!)[0];
  const trend = [...history].reverse().filter((r) => r.estimatedBand !== null);

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="summary-title" className="bg-gradient-to-br from-primary-soft to-surface">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <ProgressRing value={band !== null ? (band / 6) * 100 : 0} size={148} stroke={12} label={band !== null ? `Estimated band ${formatBand(band)} of 6` : rating ? "Rating in progress" : "No estimate"}>
            {rating ? <LoadingWave className="h-7 text-primary" label="Rating in progress" /> : <span className="text-3xl font-extrabold text-ink">{band !== null ? formatBand(band) : "–"}</span>}
            <span className="text-xs text-muted">{band !== null ? `of 6 · ${cefrForBand(band)}` : rating ? "rating…" : "no estimate"}</span>
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
                "This test had no Reading or Listening questions."
              )}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted md:justify-start">
              <Clock className="size-4" aria-hidden /> {formatMinutes(result.durationSeconds / 60)} · {formatDate(result.completedAt)}
            </p>
            <p className="mt-3 text-xs text-muted">
              A rough estimate on the TOEFL 2026 scale (1–6) from a short practice test: the average of the section bands. Reading and Listening are scored from your answers;
              Writing and Speaking are rated by AI. It is not an official or certified TOEFL score.
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

      <ScoringStatus result={result} />
      <CertificateCallout result={result} />

      <Card as="section" aria-labelledby="breakdown-title">
        <CardHeader title={<span id="breakdown-title">Section breakdown</span>} description="Reading and Listening are scored from your answers. Writing and Speaking are rated by AI on the same 1–6 scale." />
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
                {p !== null ? (
                  <ProgressBar value={p} tone={tone.tone} label={`${getSkill(s.skill).title} accuracy`} showValue />
                ) : s.band !== null ? (
                  <StatusBadge tone="primary" className="self-start">AI-rated</StatusBadge>
                ) : (
                  <StatusBadge className="self-start">{rating ? "Rating…" : "Not rated"}</StatusBadge>
                )}
                {s.note && <p className="text-sm text-body">{s.note}</p>}
                {!!s.comments?.length && (
                  <ul className="space-y-1.5 text-sm text-body">
                    {s.comments.map((c, i) => (
                      <li key={i} className="rounded-lg bg-surface/80 px-3 py-2">
                        {s.comments!.length > 1 && <span className="font-semibold text-ink">Answer {i + 1}: </span>}
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-4 font-semibold">Date</th>
                {SKILL_COLUMNS.map((skill) => (
                  <th key={skill} className="py-2 pr-4 font-semibold">
                    {getSkill(skill).title}
                  </th>
                ))}
                <th className="py-2 pr-4 font-semibold">Overall</th>
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 font-semibold">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={r.id} className={cn("border-b border-line/70", i === 0 && "font-semibold")}>
                  <td className="py-2.5 pr-4 text-ink">{formatDate(r.completedAt)}</td>
                  {SKILL_COLUMNS.map((skill) => (
                    <td key={skill} className="py-2.5 pr-4 tabular-nums">
                      {bandOf(r, skill) !== null ? formatBand(bandOf(r, skill)!) : "–"}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 tabular-nums text-ink">{r.estimatedBand !== null ? `${formatBand(r.estimatedBand)} of 6` : r.scoring === "pending" ? "Rating…" : "–"}</td>
                  <td className="py-2.5 pr-4 text-muted">{formatMinutes(r.durationSeconds / 60)}</td>
                  <td className="py-2.5 pr-4">
                    {r.certificateCode ? (
                      <Link href={verifyPath(r.certificateCode)} className="font-semibold text-primary hover:underline">
                        View
                      </Link>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
