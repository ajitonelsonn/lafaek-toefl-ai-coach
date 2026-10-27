"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { PRACTICE_TYPES, practiceHref } from "@/lib/config/practice-types";
import type { GenerationBatchDTO } from "@/lib/practice/generation-dto";
import { api, errorMessage } from "@/lib/client/api";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { SkillIconTile } from "@/components/practice/icons";
import { GenerationBadge } from "./GenerationStatus";
import { formatRelative } from "@/lib/utils/format";

const ACTIVE = (b: GenerationBatchDTO) => b.status === "queued" || b.status === "running" || b.tasks.some((t) => t.state === "queued" || t.state === "generating");

/** Real generation status from the server; polls while work is in progress. */
export function GenerationProgress({ initial, hasPlan, compact = false }: { initial: GenerationBatchDTO | null; hasPlan: boolean; compact?: boolean }) {
  const toast = useToast();
  const [batch, setBatch] = useState(initial);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ batch: GenerationBatchDTO | null }>("/api/generation/current");
      setBatch(r.batch);
    } catch {
      /* keep the last known state */
    }
  }, []);

  useEffect(() => {
    if (!batch || !ACTIVE(batch)) return;
    const t = window.setInterval(refresh, 5000);
    return () => window.clearInterval(t);
  }, [batch, refresh]);

  if (!batch) {
    return (
      <EmptyState
        icon={<Sparkles className="size-7" />}
        title={hasPlan ? "Personalised practice has not started" : "Personalised practice starts after your study plan"}
        description="The starter set for all 12 task types is ready now. After you finish your study plan, new questions are generated for you in the background."
        action={<LinkButton href="/study-plan" size="sm">{hasPlan ? "Open study plan" : "Create study plan"}</LinkButton>}
      />
    );
  }

  const ready = batch.tasks.filter((t) => t.state === "ready").length;
  const totalItems = batch.tasks.reduce((n, t) => n + t.itemsTotal, 0);
  const readyItems = batch.tasks.reduce((n, t) => n + Math.min(t.itemsReady, t.itemsTotal), 0);
  const canRetry = batch.tasks.some((t) => t.canRetry);
  const list = compact ? batch.tasks.filter((t) => t.state !== "ready").slice(0, 4) : batch.tasks;

  const retry = async () => {
    setRetrying(true);
    try {
      const r = await api<{ requeued: number; batch: GenerationBatchDTO }>(`/api/generation/${batch.id}/retry-failed`, { body: {} });
      setBatch(r.batch);
      toast(r.requeued ? "Retrying the failed practice types." : "Nothing left to retry.", "info");
    } catch (e) {
      toast(errorMessage(e), "warning");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-body">
          <span className="font-bold text-ink">{ready} of 12</span> practice types have personalised questions
        </p>
        {canRetry && (
          <Button size="sm" variant="secondary" leftIcon={<RotateCcw className="size-4" />} loading={retrying} onClick={retry}>
            Retry failed
          </Button>
        )}
      </div>
      <ProgressBar value={readyItems} max={Math.max(1, totalItems)} label="Personalised questions generated" showValue />
      <p className="text-xs text-muted">
        Questions are created by AI (Meta) in the background and checked before you see them. You can leave this page; progress continues.
        {batch.tasks.some((t) => t.media.audio === "blocked" || t.media.image === "blocked") && " Audio and pictures will be added once media storage is set up."}
      </p>
      {list.length > 0 && (
        <ul className={compact ? "flex flex-col gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
          {list.map((t) => {
            const type = PRACTICE_TYPES.find((p) => p.slug === t.slug)!;
            return (
              <li key={t.slug} className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft p-3">
                <SkillIconTile skill={type.skill} slug={type.slug} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={practiceHref(type.slug)} className="block truncate text-sm font-semibold text-ink hover:text-primary">
                    {type.title}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <GenerationBadge state={t.state} />
                    {t.itemsTotal > 0 && (
                      <span className="text-xs font-semibold text-muted tabular-nums">
                        {Math.min(t.itemsReady, t.itemsTotal)}/{t.itemsTotal} questions
                      </span>
                    )}
                  </div>
                  {t.message && <p className="mt-1 text-xs text-muted">{t.message}</p>}
                  <p className="mt-1 text-xs text-muted">Updated {formatRelative(t.updatedAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {compact && ready === 12 && <p className="text-sm font-semibold text-success">All 12 practice types have personalised questions.</p>}
    </div>
  );
}
