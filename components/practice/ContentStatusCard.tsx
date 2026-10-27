"use client";

import Link from "next/link";
import type { PracticeType } from "@/lib/config/practice-types";
import type { GenerationTaskDTO } from "@/lib/practice/generation-dto";
import { GenerationBadge } from "@/components/generation/GenerationStatus";

/** What content this practice page has right now (from the server). */
export function ContentStatusCard({ type, starterCount, generatedCount, task }: { type: PracticeType; starterCount: number; generatedCount: number; task: GenerationTaskDTO | null }) {
  return (
    <section aria-label="Practice content" className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-bold text-ink">Practice content</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Personalised sets</dt>
          <dd className="font-semibold text-ink">{generatedCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Starter sets</dt>
          <dd className="font-semibold text-ink">{starterCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Planned library size</dt>
          <dd className="font-semibold text-ink">{type.referenceCount}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Personalised questions</p>
        {task ? (
          <div className="space-y-1.5">
            <GenerationBadge state={task.state} />
            {task.message && <p className="text-xs text-muted">{task.message}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Start after you{" "}
            <Link href="/study-plan" className="font-semibold text-primary hover:underline">
              create a study plan
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
