"use client";

import { useState } from "react";
import { CalendarRange, Info } from "lucide-react";
import type { UsageDTO } from "@/lib/practice/insights-dto";
import { useSession } from "@/components/session/SessionProvider";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TipCard } from "@/components/ui/Callouts";
import { Icon3D } from "@/components/ui/Icon3D";
import { ColumnChart } from "@/components/charts/Charts";
import { UsageMetricCard, type UsageMetricView } from "./UsageMetricCard";

type Range = UsageDTO["range"];
const RANGE_LABEL: Record<Range, string> = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function metricsOf(u: UsageDTO): UsageMetricView[] {
  return [
    {
      id: "tokens",
      label: "AI text tokens",
      icon: "ai-coach",
      value: u.text.tokensReported ? formatNumber((u.text.inputTokens ?? 0) + (u.text.outputTokens ?? 0)) : "Not reported",
      note: u.text.tokensReported ? `${formatNumber(u.text.inputTokens ?? 0)} in · ${formatNumber(u.text.outputTokens ?? 0)} out (reported by Meta)` : "No AI text requests in this period.",
    },
    { id: "requests", label: "AI text requests", icon: "message", value: formatNumber(u.text.requests), note: `${u.feedback.requests} of them for coaching feedback.` },
    { id: "items", label: "Questions generated", icon: "quiz", value: formatNumber(u.generation.itemsGenerated), note: `${u.generation.jobsCompleted} jobs done · ${u.generation.jobsFailed} failed · ${u.generation.jobsPending} waiting` },
    { id: "images", label: "Images generated", icon: "image", value: formatNumber(u.images.generated), note: "Illustrations made for your practice." },
    {
      id: "speech",
      label: "Audio generated",
      icon: "audio",
      value: `${formatNumber(u.speech.clips)} clips`,
      note: `About ${formatNumber(Math.round(u.speech.estimatedSeconds / 60))} min, ${formatNumber(u.speech.characters)} characters (ElevenLabs).`,
      estimate: true,
    },
    { id: "asr", label: "Speech transcribed", icon: "voice", value: `${formatNumber(Math.round(u.transcription.audioSeconds))} s`, note: `${u.transcription.requests} recordings transcribed (Meta).` },
    { id: "storage", label: "Media stored", icon: "document", value: bytes(u.storage.bytes), note: `${u.storage.assets} private files.` },
    { id: "attempts", label: "Practice answers", icon: "practice-test", value: formatNumber(u.practice.attempts), note: "Answers you submitted." },
  ];
}

export function UsagePage({ usage }: { usage: Record<Range, UsageDTO> }) {
  const { user } = useSession();
  const [range, setRange] = useState<Range>("30d");
  const u = usage[range];
  const metrics = metricsOf(u);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="flex max-w-2xl items-start gap-2 text-sm text-body">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Usage recorded for your account. Token counts come from the AI provider; audio length is estimated because the speech provider does not report it.
          </p>
          <Select
            label="Date range"
            srOnlyLabel
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            options={(Object.keys(RANGE_LABEL) as Range[]).map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
            containerClassName="w-48"
          />
        </div>

        <section aria-labelledby="overview-title">
          <h2 id="overview-title" className="mb-3 text-xl font-bold text-ink">
            Usage overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {metrics.map((m) => (
              <UsageMetricCard key={m.id} metric={m} />
            ))}
          </div>
        </section>

        <Card as="section" aria-labelledby="daily-title">
          <CardHeader title={<span id="daily-title">AI and media requests per day</span>} description={range === "7d" ? "Last 7 days" : "Last 30 days"} icon={<CalendarRange className="size-6 text-primary" aria-hidden />} />
          <ColumnChart
            title={`AI and media requests per day, ${range === "7d" ? "last 7 days" : "last 30 days"}`}
            data={u.daily.map((d) => ({ label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: d.requests }))}
          />
        </Card>
      </div>

      <aside className="flex flex-col gap-5" aria-label="Account">
        <Card as="section" aria-labelledby="acct-title">
          <h2 id="acct-title" className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
            <Icon3D name="user" size={26} /> Account information
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold text-ink">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Member since</dt>
              <dd className="font-semibold text-ink">{formatDate(user.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Access</dt>
              <dd className="font-semibold text-ink">Free & open source</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge tone="success">Active</StatusBadge>
              </dd>
            </div>
          </dl>
        </Card>
        <Card as="section" aria-labelledby="limits-title">
          <h2 id="limits-title" className="mb-2 text-base font-bold text-ink">
            Limits
          </h2>
          <p className="text-sm text-body">
            {u.dailyItemLimit ? `Up to ${u.dailyItemLimit} new questions can be generated for you per day.` : "No usage limits are configured for this account."} AI coaching is limited to 10 requests per hour.
          </p>
          <p className="mt-2 text-xs text-muted">{u.cost.note}</p>
        </Card>
        <TipCard>
          <p>Practising with existing questions does not use AI. Only new content generation, coaching feedback and speech transcription do.</p>
        </TipCard>
      </aside>
    </div>
  );
}
