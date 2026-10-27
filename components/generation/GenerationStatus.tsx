"use client";

import { CheckCircle2, CircleDashed, Clock3, Loader2, PauseCircle, TriangleAlert } from "lucide-react";
import type { GenerationStateDTO } from "@/lib/practice/generation-dto";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

const META: Record<GenerationStateDTO, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  not_started: { label: "Not started", tone: "neutral", icon: <CircleDashed aria-hidden /> },
  queued: { label: "Queued", tone: "primary", icon: <Clock3 aria-hidden /> },
  generating: { label: "Generating", tone: "primary", icon: <Loader2 className="animate-spin" aria-hidden /> },
  ready: { label: "Ready", tone: "success", icon: <CheckCircle2 aria-hidden /> },
  failed: { label: "Needs retry", tone: "danger", icon: <TriangleAlert aria-hidden /> },
  blocked: { label: "Waiting for setup", tone: "warning", icon: <PauseCircle aria-hidden /> },
};

export function GenerationBadge({ state, label }: { state: GenerationStateDTO; label?: string }) {
  const m = META[state];
  return (
    <StatusBadge tone={m.tone} icon={m.icon}>
      {label ?? m.label}
    </StatusBadge>
  );
}
