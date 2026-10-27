"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PRACTICE_TYPES, practiceHref } from "@/lib/config/practice-types";
import { updateDemo, useDemoState } from "@/lib/store/demo-store";
import { retryJob } from "@/lib/services/mock/generation";
import { DemoBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { GenerationStatus } from "./GenerationStatus";
import { SkillIconTile } from "@/components/practice/icons";

/** Overview of personalised-set generation for all 12 task types (simulated). */
export function GenerationProgress({ compact = false }: { compact?: boolean }) {
  const { generationJobs, studyPlan } = useDemoState();

  if (!generationJobs.length) {
    return (
      <EmptyState
        icon={<Sparkles className="size-7" />}
        title={studyPlan ? "No personalised sets yet" : "Personalised sets start after your study plan"}
        description="Sample questions for all 12 task types are ready now. Personalised practice will be generated after you finish your study plan."
        action={
          <LinkButton href="/study-plan" size="sm">
            {studyPlan ? "Open study plan" : "Create study plan"}
          </LinkButton>
        }
      />
    );
  }

  const ready = generationJobs.filter((j) => j.state === "ready").length;
  const overall = generationJobs.reduce((s, j) => s + j.progress, 0) / generationJobs.length;
  const retry = (id: string) =>
    updateDemo((s) => ({ ...s, generationJobs: s.generationJobs.map((j) => (j.id === id ? retryJob(j) : j)) }));

  const list = compact ? generationJobs.filter((j) => j.state !== "ready").slice(0, 4) : generationJobs;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-body">
          <span className="font-bold text-ink">{ready} of 12</span> personalised sets ready
        </p>
        <DemoBadge>Simulated</DemoBadge>
      </div>
      <ProgressBar value={overall} label="Overall generation progress" showValue />
      <p className="text-xs text-muted">
        AI generation is not connected yet. This progress is simulated in your browser so you can preview the experience. You can practise
        with sample questions at any time.
      </p>
      {list.length > 0 && (
        <ul className={compact ? "flex flex-col gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
          {list.map((job) => {
            const type = PRACTICE_TYPES.find((t) => t.slug === job.slug)!;
            return (
              <li key={job.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft p-3">
                <SkillIconTile skill={type.skill} slug={type.slug} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={practiceHref(type.slug)} className="block truncate text-sm font-semibold text-ink hover:text-primary">
                    {type.title}
                  </Link>
                  <div className="mt-1.5">
                    <GenerationStatus
                      state={job.state}
                      progress={job.progress}
                      itemsReady={job.itemsReady}
                      itemsTotal={job.itemsTotal}
                      error={job.state === "failed" ? job.error : undefined}
                      onRetry={() => retry(job.id)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {compact && ready === 12 && <p className="text-sm font-semibold text-success">All demo sets are ready.</p>}
    </div>
  );
}
