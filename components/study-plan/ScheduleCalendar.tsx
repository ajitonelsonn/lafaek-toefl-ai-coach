"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, ChevronDown, ClipboardCheck, Flag, Lightbulb, Sparkles } from "lucide-react";
import { getSkill, type SkillId } from "@/lib/config/practice-types";
import type { ScheduleDay, ScheduleWeek } from "@/lib/services/types";
import { shortDay } from "@/lib/practice/plan-dto";
import { gsap, prefersReducedMotion } from "@/lib/client/motion";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const TYPE_BADGE: Record<ScheduleDay["type"], { label: string; tone: "primary" | "warning" | "success" | "neutral" } | null> = {
  study: null,
  "mock-test": { label: "Mock test", tone: "warning" },
  "final-review": { label: "Light review", tone: "primary" },
  test: { label: "Test day", tone: "success" },
};

const range = (w: ScheduleWeek) => {
  const a = shortDay(w.start).slice(4);
  const b = shortDay(w.end).slice(4);
  return a === b ? a : `${a} – ${b}`;
};

/** Softly reveals the day rows of a week that was just opened. */
function revealRows(el: HTMLElement | null) {
  if (!el || el.dataset.shown || prefersReducedMotion()) return;
  el.dataset.shown = "1";
  gsap.from(el.children, { y: 8, autoAlpha: 0, duration: 0.3, stagger: 0.04, ease: "power2.out", clearProps: "transform,opacity,visibility" });
}

export function ScheduleCalendar({ weeks, schedule, today, source, pending }: { weeks: ScheduleWeek[]; schedule: ScheduleDay[]; today: string; source?: "rules" | "ai"; pending: boolean }) {
  const current = (schedule.find((d) => d.date >= today) ?? schedule.at(-1))?.week ?? 1;
  const [open, setOpen] = useState<Set<number>>(() => new Set([current, current + 1]));
  const [showAll, setShowAll] = useState(false);
  const long = weeks.length > 6;
  const visible = long && !showAll ? weeks.filter((w) => w.week >= current - 1 && w.week <= current + 3) : weeks;
  const toggle = (week: number) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(week)) n.delete(week);
    else n.add(week);
    return n;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {pending ? (
          <StatusBadge tone="primary">
            <Sparkles className="size-3.5" aria-hidden /> Personalising with AI…
          </StatusBadge>
        ) : source === "ai" ? (
          <StatusBadge tone="success">
            <Sparkles className="size-3.5" aria-hidden /> Personalised by AI
          </StatusBadge>
        ) : (
          <StatusBadge>Planned from your answers</StatusBadge>
        )}
        <span className="text-muted">
          {schedule.filter((d) => d.type !== "test").length} study days · {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {visible.map((w) => {
          const days = schedule.filter((d) => d.week === w.week);
          const isOpen = open.has(w.week);
          const isPast = w.end < today;
          return (
            <li key={w.week} className={cn("rounded-xl border", w.week === current ? "border-primary/40 bg-primary-soft/40" : "border-line", isPast && "opacity-70")}>
              <button type="button" onClick={() => toggle(w.week)} aria-expanded={isOpen} className="flex w-full items-start gap-3 rounded-xl p-4 text-left hover:bg-surface-muted/60">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-on-primary" aria-hidden>
                  {w.week}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-bold text-ink">Week {w.week}</span>
                    <span className="text-sm text-muted">{range(w)}</span>
                    {w.week === current && <StatusBadge tone="primary">This week</StatusBadge>}
                    {w.mockTestDate && <StatusBadge tone="warning">Mock test</StatusBadge>}
                  </span>
                  <span className="mt-0.5 block text-[15px] font-semibold text-body">{w.theme}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.focusSkills.map((s: SkillId) => (
                      <span key={s} className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
                        {getSkill(s).title}
                      </span>
                    ))}
                  </span>
                </span>
                <ChevronDown className={cn("mt-2 size-5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>

              {isOpen && (
                <div className="border-t border-line px-4 pb-4 pt-3">
                  <p className="mb-3 flex items-start gap-2 text-sm text-body">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {w.tip}
                  </p>
                  {days.length === 0 ? (
                    <p className="text-sm text-muted">No study days this week.</p>
                  ) : (
                    <ul ref={revealRows} className="flex flex-col gap-2">
                      {days.map((d) => (
                        <DayRow key={d.date} day={d} today={today} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {long && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show weeks around today" : `Show all ${weeks.length} weeks`}
        </Button>
      )}
    </div>
  );
}

function DayRow({ day, today }: { day: ScheduleDay; today: string }) {
  const badge = TYPE_BADGE[day.type];
  const isToday = day.date === today;
  const isPast = day.date < today;
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start", isToday ? "border-primary bg-surface shadow-card" : "border-line bg-surface", isPast && "opacity-60")}>
      <div className="flex shrink-0 items-center gap-2 sm:w-36 sm:flex-col sm:items-start sm:gap-1">
        <span className="font-semibold text-ink">{shortDay(day.date)}</span>
        <span className="flex flex-wrap gap-1">
          {isToday && <StatusBadge tone="primary">Today</StatusBadge>}
          {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        </span>
      </div>
      {day.type === "test" ? (
        <p className="flex items-start gap-2 text-sm font-semibold text-success">
          <Flag className="mt-0.5 size-4 shrink-0" aria-hidden /> {day.focus}
        </p>
      ) : (
        <ul className="flex flex-1 flex-wrap gap-2">
          {day.tasks.map((t, i) => (
            <li key={i}>
              <Link href={t.href} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-body hover:border-primary hover:text-primary">
                {t.kind === "mock-test" ? <ClipboardCheck className="size-3.5 text-warning" aria-hidden /> : t.kind === "vocabulary" ? <CalendarCheck className="size-3.5 text-primary" aria-hidden /> : null}
                {t.label} <span className="text-muted">· {t.minutes} min</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
