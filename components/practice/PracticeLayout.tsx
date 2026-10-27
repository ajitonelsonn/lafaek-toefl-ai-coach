"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronUp, Info } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import { PRACTICE_GUIDES } from "@/lib/content/practice-guides";
import { SkillIconTile } from "./icons";
import { TipCard } from "@/components/ui/Callouts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils/cn";

interface PracticeLayoutProps {
  type: PracticeType;
  position: string;
  timer: ReactNode;
  sidebar?: ReactNode;
  footer: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  /** Replace default instructions (e.g. to add counts). */
  instructions?: string[];
  /** Source of the current item: personalised (AI-generated) or the hand-written starter set. */
  source?: "starter" | "generated";
}

export function PracticeLayout({ type, position, timer, sidebar, footer, banner, children, instructions, source }: PracticeLayoutProps) {
  const guide = PRACTICE_GUIDES[type.slug];
  const [showInstructions, setShowInstructions] = useState(true);
  const steps = instructions ?? guide.instructions;

  return (
    <div>
      <Link href="/practice" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft className="size-4" aria-hidden /> Back to Practice Center
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr]">
        <div className="order-1 xl:col-start-2 xl:row-start-1">{timer}</div>

        <div className="order-2 min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
            <header className="flex flex-wrap items-start gap-4 border-b border-line p-5 sm:p-6">
              <span className="hidden sm:block">
                <SkillIconTile skill={type.skill} slug={type.slug} size="lg" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{type.title}</h1>
                  {source && <StatusBadge tone={source === "generated" ? "primary" : "neutral"}>{source === "generated" ? "Personalised · AI-generated" : "Starter set"}</StatusBadge>}
                </div>
                <p className="mt-1 text-base text-muted sm:text-lg">{type.instruction}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-semibold text-ink tabular-nums">{position}</span>
                <button
                  type="button"
                  onClick={() => setShowInstructions((s) => !s)}
                  aria-expanded={showInstructions}
                  aria-controls={`${type.slug}-instructions`}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-line text-primary hover:border-primary"
                  aria-label={showInstructions ? "Hide instructions" : "Show instructions"}
                >
                  <ChevronUp className={cn("size-4 transition-transform", !showInstructions && "rotate-180")} />
                </button>
              </div>
            </header>
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              {showInstructions && (
                <div id={`${type.slug}-instructions`} className="rounded-xl bg-primary-soft/70 p-4">
                  <p className="mb-1.5 flex items-center gap-2 font-bold text-ink">
                    <Info className="size-5 text-primary" aria-hidden /> Instructions
                  </p>
                  <ul className="list-disc space-y-1 pl-12 text-sm text-body sm:text-[15px]">
                    {steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {banner}
              {children}
            </div>
          </section>
          <div className="mt-5">{footer}</div>
        </div>

        <div className="order-3 flex flex-col gap-5 xl:col-start-2 xl:row-start-2">
          {sidebar}
          <TipCard>
            <ul className="list-disc space-y-1 pl-4">
              {guide.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </TipCard>
        </div>
      </div>
    </div>
  );
}

export function PracticeFooter({ left, right }: { left?: ReactNode; right: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3">{left}</div>
      <div className="ml-auto flex flex-wrap justify-end gap-3">{right}</div>
    </div>
  );
}
