"use client";

import { useState } from "react";
import { CalendarRange, Info } from "lucide-react";
import type { UsageRange, UsageSummary } from "@/lib/services/types";
import { useDemoState, useHydrated } from "@/lib/store/demo-store";
import { formatDate, percent } from "@/lib/utils/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DemoBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { TipCard } from "@/components/ui/Callouts";
import { Icon3D } from "@/components/ui/Icon3D";
import { ColumnChart } from "@/components/charts/Charts";
import { METRIC_ICON, UsageMetricCard, formatMetric } from "./UsageMetricCard";

const RANGE_LABEL: Record<UsageRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

export function UsagePage({ summaries }: { summaries: Record<UsageRange, UsageSummary> }) {
  const hydrated = useHydrated();
  const { user } = useDemoState();
  const [range, setRange] = useState<UsageRange>("all");
  const summary = summaries[range];
  const limited = summary.metrics.filter((m) => m.limit !== null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="flex max-w-2xl items-start gap-2 text-sm text-body">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            These numbers are demo data. Real usage will come from your account once the AI and media services are connected.
          </p>
          <Select
            label="Date range"
            srOnlyLabel
            value={range}
            onChange={(e) => setRange(e.target.value as UsageRange)}
            options={(Object.keys(RANGE_LABEL) as UsageRange[]).map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
            containerClassName="w-48"
          />
        </div>

        <section aria-labelledby="overview-title">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="overview-title" className="text-xl font-bold text-ink">
              Usage overview
            </h2>
            <DemoBadge />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {summary.metrics.map((m) => (
              <UsageMetricCard key={m.id} metric={m} />
            ))}
          </div>
        </section>

        <Card as="section" aria-labelledby="daily-title">
          <CardHeader
            title={<span id="daily-title">AI requests per day</span>}
            description={range === "all" ? "Last 30 days" : RANGE_LABEL[range]}
            icon={<CalendarRange className="size-6 text-primary" aria-hidden />}
          />
          <ColumnChart
            title={`AI requests per day, ${RANGE_LABEL[range].toLowerCase()}`}
            data={summary.daily.map((d) => ({ label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: d.requests }))}
            formatValue={(v) => String(Math.round(v))}
          />
        </Card>

        <Card as="section" aria-labelledby="detail-title">
          <CardHeader title={<span id="detail-title">Detailed usage</span>} description="Everything this account has used in the selected period." />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Detailed usage for {RANGE_LABEL[range]}</caption>
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">Feature</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Used</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Limit</th>
                  <th scope="col" className="w-48 py-2 font-semibold">Share of limit</th>
                </tr>
              </thead>
              <tbody>
                {summary.metrics.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <Icon3D name={METRIC_ICON[m.id]} size={22} /> {m.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-ink tabular-nums">{formatMetric(m, m.value)}</td>
                    <td className="py-2.5 pr-4 text-body tabular-nums">{m.limit !== null ? formatMetric(m, m.limit) : "No limit set"}</td>
                    <td className="py-2.5">
                      {m.limit !== null ? <ProgressBar value={m.value} max={m.limit} label={`${m.label} share of limit`} showValue size="sm" /> : <span className="text-muted">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col divide-y divide-line md:hidden">
            {summary.metrics.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <Icon3D name={METRIC_ICON[m.id]} size={22} /> {m.label}
                </span>
                <span className="text-right tabular-nums text-ink">
                  {formatMetric(m, m.value)}
                  {m.limit !== null && <span className="block text-xs text-muted">of {formatMetric(m, m.limit)}</span>}
                </span>
              </li>
            ))}
          </ul>
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
              <dd className="font-semibold text-ink">{hydrated ? (user?.name ?? "Not signed in") : "…"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Member since</dt>
              <dd className="font-semibold text-ink">{hydrated && user ? formatDate(user.createdAt) : "–"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Access</dt>
              <dd className="font-semibold text-ink">Free & open source</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge tone={user ? "success" : "neutral"}>{hydrated && user ? "Active (demo)" : "Demo visitor"}</StatusBadge>
              </dd>
            </div>
          </dl>
        </Card>
        {limited.length > 0 && (
          <Card as="section" aria-labelledby="limits-title">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="limits-title" className="text-base font-bold text-ink">
                Usage limits
              </h2>
              <DemoBadge>Demo limits</DemoBadge>
            </div>
            <ul className="flex flex-col gap-4">
              {limited.map((m) => (
                <li key={m.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{m.label}</span>
                    <span className="text-body tabular-nums">
                      {formatMetric(m, m.value)} / {formatMetric(m, m.limit!)}
                    </span>
                  </div>
                  <ProgressBar value={m.value} max={m.limit!} label={`${m.label}: ${percent(m.value, m.limit!)}% used`} showValue size="sm" />
                </li>
              ))}
            </ul>
          </Card>
        )}
        <TipCard>
          <p>Usage counts AI questions, images and audio made for your account. Practising with sample questions does not use any of your limits.</p>
        </TipCard>
      </aside>
    </div>
  );
}
