"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { BOOST_PACK, planName } from "@/lib/config/pricing";
import { formatDate } from "@/lib/utils/format";
import { gsap, useMotion } from "@/lib/client/motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CountUp } from "@/components/motion/CountUp";
import { UpgradeDialog } from "@/components/upgrade/UpgradeDialog";
import { cn } from "@/lib/utils/cn";

export interface AccountPlanDTO {
  planCredits: number;
  mockCredits: number;
  packs: number;
  used: { studyPlans: number; mockTests: number };
  grants: { date: string; packs: number; planCredits: number; mockCredits: number }[];
}


/** Usage page: the learner's plan, lifetime credits left, and how to get more. */
export function PlanCard({ plan }: { plan: AccountPlanDTO }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useMotion(root, () => {
    gsap.from("[data-plan-icon]", { scale: 0, rotation: -20, duration: 0.6, ease: "back.out(2.2)" });
    gsap.from("[data-plan-tile]", { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.1, delay: 0.15, ease: "power2.out" });
  });

  const tiles = [
    { id: "plans", label: "Study plans left", left: plan.planCredits, used: plan.used.studyPlans, unit: "made", icon: "/assets/pricing/starter.png" },
    { id: "mocks", label: "Mock tests left", left: plan.mockCredits, used: plan.used.mockTests, unit: "taken", icon: "/assets/pricing/crown.png" },
  ];
  const out = plan.planCredits === 0 || plan.mockCredits === 0;

  return (
    <Card as="section" aria-labelledby="plan-title" className={cn("bg-gradient-to-br to-surface", plan.packs ? "from-primary-soft" : "from-success-soft")}>
      <div ref={root} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <span data-plan-icon className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-surface">
            <Image src={plan.packs ? "/assets/pricing/boost.png" : "/assets/pricing/starter.png"} alt="" width={64} height={64} className="size-12" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">Your plan</p>
            <h2 id="plan-title" className="text-2xl font-extrabold text-ink">
              {planName(plan)}
            </h2>
            <p className="text-sm text-body">Credits are for life and never expire. Each {BOOST_PACK.name} adds 1 study plan and 2 mock tests.</p>
          </div>
          <Button leftIcon={<Sparkles className="size-4" />} variant={out ? "primary" : "secondary"} onClick={() => setOpen(true)}>
            Upgrade · ${BOOST_PACK.priceUsd}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {tiles.map((t) => (
            <div key={t.id} data-plan-tile className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <Image src={t.icon} alt="" width={56} height={56} className="size-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">{t.label}</p>
                <p className={cn("text-3xl font-extrabold tabular-nums", t.left ? "text-ink" : "text-danger")}>
                  <CountUp text={String(t.left)} />
                </p>
                <p className="text-xs text-muted">
                  {t.used} {t.unit} so far
                </p>
              </div>
              {t.left === 0 && <StatusBadge tone="danger">Used up</StatusBadge>}
            </div>
          ))}
        </div>

        {plan.grants.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Upgrade history</p>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
              {plan.grants.map((g, i) => (
                <li key={`${g.date}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="font-semibold text-ink">
                    {g.packs} {BOOST_PACK.name}
                    {g.packs === 1 ? "" : "s"}
                  </span>
                  <span className="text-body">
                    +{g.planCredits} study plan{g.planCredits === 1 ? "" : "s"} · +{g.mockCredits} mock tests
                  </span>
                  <span className="text-muted">{formatDate(g.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <UpgradeDialog open={open} onClose={() => setOpen(false)} reason={plan.planCredits === 0 ? "plan" : "mock"} credits={plan} />
    </Card>
  );
}
