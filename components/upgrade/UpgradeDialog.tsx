"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Copy, Mail } from "lucide-react";
import { BOOST_PACK, upgradeMailto } from "@/lib/config/pricing";
import { SITE } from "@/lib/config/site";
import { gsap, useMotion } from "@/lib/client/motion";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/session/SessionProvider";

/**
 * Explains the Boost Pack ($5: +1 study plan, +2 mock tests) and how to buy it: email the admin,
 * who adds the pack to the account after payment.
 */
export function UpgradeDialog({ open, onClose, reason, credits }: { open: boolean; onClose: () => void; reason: "plan" | "mock"; credits: { planCredits: number; mockCredits: number } }) {
  const { user } = useSession();
  const body = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useMotion(
    body,
    () => {
      if (!open) return;
      const tl = gsap.timeline({ defaults: { ease: "back.out(1.8)" } });
      tl.from("[data-up-ticket]", { y: 20, scale: 0.92, autoAlpha: 0, duration: 0.5 })
        .from("[data-up-price]", { scale: 0.4, autoAlpha: 0, duration: 0.45 }, 0.15)
        .from("[data-up-item]", { x: -12, autoAlpha: 0, duration: 0.35, stagger: 0.07, ease: "power2.out" }, 0.25)
        .from("[data-up-step]", { y: 10, autoAlpha: 0, duration: 0.35, stagger: 0.08, ease: "power2.out" }, 0.4);
      gsap.to("[data-up-rocket]", { y: -5, rotation: -8, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });
    },
    [open],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SITE.adminEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the address is shown on screen */
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={reason === "plan" ? "Upgrade to make a new study plan" : "Upgrade for more mock tests"}
      description={reason === "plan" ? "You have used your study plans. A Boost Pack adds one more, with new personalised questions." : "You have used your mock tests. A Boost Pack adds two more, each with new questions."}
    >
      <div ref={body} className="flex flex-col gap-5">
        <div data-up-ticket className="relative overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary-soft via-surface to-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-lg font-extrabold text-ink">
                <span data-up-rocket className="inline-flex">
                  <Image src="/assets/pricing/boost.png" alt="" width={48} height={48} className="size-10" />
                </span>
                {BOOST_PACK.name}
              </p>
              <p className="text-sm text-muted">One-time payment, per pack</p>
            </div>
            <p data-up-price className="text-right">
              <span className="text-4xl font-extrabold text-primary">${BOOST_PACK.priceUsd}</span>
            </p>
          </div>
          <ul className="mt-4 space-y-2 text-[15px] text-body">
            {[`+${BOOST_PACK.planCredits} new AI study plan, with new questions`, `+${BOOST_PACK.mockCredits} AI mock tests`, "Buy as many packs as you need"].map((t) => (
              <li key={t} data-up-item className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-success" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-surface/80 px-3 py-2 text-sm text-body">
            You have <span className="font-bold text-ink">{credits.planCredits}</span> study plan{credits.planCredits === 1 ? "" : "s"} and{" "}
            <span className="font-bold text-ink">{credits.mockCredits}</span> mock test{credits.mockCredits === 1 ? "" : "s"} left.
          </p>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {["Email the admin", `Pay $${BOOST_PACK.priceUsd} as agreed`, "The admin adds your pack"].map((t, i) => (
            <li key={t} data-up-step className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm font-semibold text-ink">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-on-primary">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={upgradeMailto(user?.email)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-[15px] font-semibold text-on-primary shadow-sm hover:bg-primary-hover"
          >
            <Mail className="size-4" aria-hidden /> Email {SITE.adminEmail}
          </a>
          <Button variant="secondary" leftIcon={copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />} onClick={() => void copy()}>
            {copied ? "Copied" : "Copy email"}
          </Button>
        </div>
        <p className="text-xs text-muted">Your new study plan and mock tests appear in your account as soon as the admin adds the pack.</p>
      </div>
    </Dialog>
  );
}
