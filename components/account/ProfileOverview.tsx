"use client";

import Link from "next/link";
import { useRef } from "react";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import type { ProfileOverviewDTO } from "@/lib/practice/profile-dto";
import { shortDay } from "@/lib/practice/plan-dto";
import { todayKey } from "@/lib/utils/dates";
import { formatDate } from "@/lib/utils/format";
import { gsap, useMotion } from "@/lib/client/motion";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { PlanCard } from "@/components/usage/PlanCard";
import { cn } from "@/lib/utils/cn";

const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/** Profile page: plan and credits, study goal, best mock test result and achievements. */
export function ProfileOverview({ overview }: { overview: ProfileOverviewDTO }) {
  const { goal, bestMock, achievements } = overview;
  const daysLeft = goal?.testDate ? Math.round((Date.parse(`${goal.testDate}T12:00:00Z`) - Date.parse(`${todayKey()}T12:00:00Z`)) / 86_400_000) : null;
  const earned = achievements.filter((a) => a.earned).length;
  const badges = useRef<HTMLUListElement>(null);
  useMotion(badges, () => {
    gsap.from("[data-badge]", { y: 16, scale: 0.9, autoAlpha: 0, duration: 0.45, stagger: 0.07, ease: "back.out(1.8)" });
    gsap.from("[data-badge-earned] [data-badge-icon]", { rotation: -20, scale: 0.6, duration: 0.7, stagger: 0.1, delay: 0.25, ease: "elastic.out(1, 0.5)" });
  });

  return (
    <div className="mt-6 flex flex-col gap-6">
      <PlanCard plan={overview.plan} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="goal-title" className="flex flex-col gap-4">
          <h2 id="goal-title" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Icon3D name="goal" size={30} /> My study goal
          </h2>
          {goal ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-primary-soft/70 p-4">
                  <p className="text-sm text-muted">Target score</p>
                  <p className="text-3xl font-extrabold text-ink">
                    {formatBand(goal.targetScore)} <span className="text-base font-semibold text-muted">of 6 · {cefrForBand(goal.targetScore)}</span>
                  </p>
                </div>
                <div className="rounded-xl bg-success-soft/70 p-4">
                  <p className="text-sm text-muted">{goal.testDate ? `Test on ${shortDay(goal.testDate)}` : "Test date"}</p>
                  <p className="text-3xl font-extrabold text-ink">
                    {daysLeft === null ? "Not set" : daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"}` : daysLeft === 0 ? "Today!" : "Done"}
                    {daysLeft !== null && daysLeft > 0 && <span className="text-base font-semibold text-muted"> to go</span>}
                  </p>
                </div>
              </div>
              <p className="text-sm text-body">
                Studying {goal.studyDays.map((d) => DAY_LABEL[d]).join(", ")} · {goal.dailyMinutes} min a day{goal.testDate ? "" : ` · ${goal.totalWeeks}-week plan`}
              </p>
              <LinkButton href="/study-plan" variant="secondary" size="sm" className="self-start" leftIcon={<Icon3D name="calendar" size={18} />}>
                View my schedule
              </LinkButton>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 text-sm text-body">
              <p>You have not made a study plan yet. Tell us your level, target score and test date, and we will plan every study day.</p>
              <LinkButton href="/study-plan" size="sm">
                Make my study plan
              </LinkButton>
            </div>
          )}
        </Card>

        <Card as="section" aria-labelledby="best-title" className="flex flex-col gap-4">
          <h2 id="best-title" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Icon3D name="score" size={30} /> Best mock test
          </h2>
          {bestMock ? (
            <>
              <div className="flex items-center gap-4 rounded-xl bg-warning-soft/60 p-4">
                <Icon3D name="achievement" size={52} />
                <div>
                  <p className="text-sm text-muted">Highest estimated band</p>
                  <p className="text-3xl font-extrabold text-ink">
                    {bestMock.band !== null ? formatBand(bestMock.band) : "–"}
                    {bestMock.band !== null && <span className="text-base font-semibold text-muted"> of 6 · {cefrForBand(bestMock.band)}</span>}
                  </p>
                </div>
              </div>
              <p className="text-sm text-body">
                {bestMock.tests} mock {bestMock.tests === 1 ? "test" : "tests"} taken · latest {formatDate(bestMock.latest)}. A practice estimate, not an official TOEFL score.
              </p>
              <LinkButton href="/mock-test/results" variant="secondary" size="sm" className="self-start" leftIcon={<Icon3D name="history" size={18} />}>
                See my results
              </LinkButton>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 text-sm text-body">
              <p>No mock test yet. Take one to see your estimated band on the 1–6 scale.</p>
              <LinkButton href="/mock-test" size="sm">
                Take a mock test
              </LinkButton>
            </div>
          )}
        </Card>
      </div>

      <Card as="section" aria-labelledby="ach-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="ach-title" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Icon3D name="achievement" size={30} /> Achievements
          </h2>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-semibold text-ink">
            {earned} of {achievements.length} earned
          </span>
        </div>
        <ul ref={badges} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {achievements.map((a) => (
            <li
              key={a.id}
              data-badge
              {...(a.earned ? { "data-badge-earned": "" } : {})}
              className={cn("flex items-center gap-4 rounded-2xl border p-4", a.earned ? "border-warning/40 bg-gradient-to-br from-warning-soft to-surface" : "border-line bg-surface-soft")}
            >
              <span data-badge-icon className={cn("inline-flex size-14 shrink-0 items-center justify-center rounded-full", a.earned ? "bg-surface shadow-card ring-2 ring-warning/50" : "bg-surface-muted grayscale opacity-60")}>
                <Icon3D name={a.icon} size={34} />
              </span>
              <div className="min-w-0">
                <p className={cn("font-bold", a.earned ? "text-ink" : "text-muted")}>{a.title}</p>
                <p className="text-sm text-body">{a.description}</p>
                <p className={cn("mt-0.5 text-xs font-semibold", a.earned ? "text-success" : "text-muted")}>{a.earned ? "Earned" : (a.progress ?? "Not yet")}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Keep going in the{" "}
          <Link href="/practice" className="font-semibold text-primary hover:underline">
            Practice Center
          </Link>{" "}
          to earn the rest.
        </p>
      </Card>
    </div>
  );
}
