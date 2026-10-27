"use client";

import Link from "next/link";
import type { PracticeType } from "@/lib/config/practice-types";
import { useDemoState } from "@/lib/store/demo-store";
import { updateDemo } from "@/lib/store/demo-store";
import { retryJob } from "@/lib/services/mock/generation";
import { GenerationStatus, jobFor } from "@/components/generation/GenerationStatus";

/** Explains what content is available for this task type right now. */
export function SampleSetCard({ type, sampleCount }: { type: PracticeType; sampleCount: number }) {
  const { generationJobs, completedUnits } = useDemoState();
  const job = jobFor(generationJobs, type.slug);
  const done = completedUnits[type.slug]?.length ?? 0;
  return (
    <section aria-label="Content availability" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-bold text-ink">Practice content</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Sample set</dt>
          <dd className="font-semibold text-ink">{sampleCount} ready</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">You have practised</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {Math.min(done, sampleCount)} / {sampleCount}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Planned total</dt>
          <dd className="font-semibold text-ink">{type.referenceCount}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Personalised set</p>
        {job ? (
          <GenerationStatus
            state={job.state}
            progress={job.progress}
            itemsReady={job.itemsReady}
            itemsTotal={job.itemsTotal}
            updatedAt={job.updatedAt}
            error={job.error}
            onRetry={() => updateDemo((s) => ({ ...s, generationJobs: s.generationJobs.map((j) => (j.id === job.id ? retryJob(j) : j)) }))}
          />
        ) : (
          <div className="space-y-1.5">
            <GenerationStatus state="not_started" />
            <p className="text-xs text-muted">
              Starts after you{" "}
              <Link href="/study-plan" className="font-semibold text-primary hover:underline">
                create a study plan
              </Link>
              . Simulated in this demo.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
