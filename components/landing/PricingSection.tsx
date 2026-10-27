"use client";

import Image from "next/image";
import { useRef } from "react";
import { ArrowRight, Check, ExternalLink, Mail } from "lucide-react";
import { PRICING, BOOST_PACK, type PricingTier } from "@/lib/config/pricing";
import { SITE } from "@/lib/config/site";
import { gsap, ScrollTrigger, useMotion, prefersReducedMotion } from "@/lib/client/motion";
import { cn } from "@/lib/utils/cn";

// Per-tier colours, following the owner's pricing design (ilu/pricing.png).
const TONE: Record<PricingTier["id"], { tile: string; panel: string; amount: string; check: string }> = {
  starter: { tile: "bg-success-soft", panel: "bg-success-soft", amount: "text-success", check: "bg-success" },
  boost: { tile: "bg-surface-muted", panel: "bg-primary-soft", amount: "text-primary", check: "bg-primary" },
  "open-source": { tile: "bg-surface-muted", panel: "bg-surface-muted", amount: "text-ink", check: "bg-success" },
};

const githubPath = SITE.githubUrl.replace(/^https?:\/\//, "");

/** Landing page pricing: Starter (free for life), Boost Pack ($5) and Open Source (self-host). */
export function PricingSection({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);

  useMotion(root, (el) => {
    const cards = gsap.utils.toArray<HTMLElement>("[data-price-card]");
    gsap.set("[data-price-head] > *", { y: 24, autoAlpha: 0 });
    gsap.set(cards, { y: 60, rotationX: 12, autoAlpha: 0, transformPerspective: 800 });
    gsap.set("[data-price-note]", { y: 30, autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      once: true,
      onEnter: () => {
        const tl = gsap.timeline();
        tl.to("[data-price-head] > *", { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" })
          .to(cards, { y: 0, rotationX: 0, autoAlpha: 1, duration: 0.8, stagger: 0.15, ease: "back.out(1.4)" }, 0.2)
          .from("[data-price-icon]", { scale: 0, rotation: -25, duration: 0.6, stagger: 0.15, ease: "back.out(2.2)" }, 0.45)
          .from("[data-price-amount]", { scale: 0.3, autoAlpha: 0, duration: 0.5, stagger: 0.15, ease: "back.out(2.5)" }, 0.6)
          .from("[data-price-feature]", { x: -10, autoAlpha: 0, duration: 0.3, stagger: 0.03, ease: "power2.out" }, 0.75)
          .from("[data-price-crown]", { y: -16, rotation: -30, autoAlpha: 0, duration: 0.6, ease: "bounce.out" }, 0.9)
          .to("[data-price-note]", { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.12, ease: "power2.out" }, 1)
          .add(() => {
            // The featured Boost Pack keeps floating with a soft glow; its rocket keeps "flying".
            gsap.to("[data-price-featured]", { y: -8, duration: 2.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
            gsap.to("[data-price-glow]", { opacity: 0.85, scale: 1.05, duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
            gsap.to("[data-price-featured] [data-price-icon]", { x: 3, y: -4, rotation: 4, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });
          });
      },
    });
  });

  const wiggle = (e: React.MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const icon = e.currentTarget.querySelector("[data-price-icon]");
    if (icon) gsap.fromTo(icon, { rotation: 0 }, { keyframes: { rotation: [0, -12, 10, -6, 0], scale: [1, 1.12, 1.12, 1.05, 1] }, duration: 0.7, ease: "power1.out", overwrite: "auto" });
  };

  return (
    <section ref={root} id="pricing" aria-labelledby="pricing-title" className="scroll-mt-24 overflow-hidden bg-gradient-to-b from-surface via-brand-50 to-surface dark:via-page">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div data-price-head className="text-center">
          <p className="flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            <span className="h-0.5 w-12 rounded bg-primary" aria-hidden /> Simple pricing <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
          </p>
          <h2 id="pricing-title" className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Start free. <span className="text-primary">Upgrade only when you need more.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-body">No subscription and nothing expires. Your free Starter allowance is for life, and each Boost Pack simply adds more.</p>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {PRICING.map((tier) => {
            const featured = !!tier.featured;
            const tone = TONE[tier.id];
            const href = tier.id === "starter" && signedIn ? "/dashboard" : tier.cta.href;
            const label = tier.id === "starter" && signedIn ? "Go to Dashboard" : tier.cta.label;
            const external = tier.id === "open-source";
            const card = (
              <article
                data-price-card
                onMouseEnter={wiggle}
                className={cn(
                  "relative flex h-full flex-col rounded-3xl bg-surface p-6 shadow-card transition-shadow duration-300 hover:shadow-xl sm:p-7",
                  featured ? "border-2 border-primary" : "border border-line",
                )}
              >
                {featured && (
                  <span className="absolute -top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary py-1.5 pl-2.5 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-on-primary shadow-md">
                    <Image data-price-crown src="/assets/pricing/crown.png" alt="" width={22} height={22} className="size-5" /> Most popular
                  </span>
                )}
                <div className="flex items-center gap-4">
                  <span className={cn("inline-flex size-20 shrink-0 items-center justify-center rounded-full", tone.tile)}>
                    <Image data-price-icon src={tier.icon} alt="" width={96} height={96} className="size-16 object-contain" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-2xl font-extrabold text-ink">{tier.name}</h3>
                    <p className="mt-0.5 text-[15px] leading-snug text-muted">{tier.summary}</p>
                  </div>
                </div>

                <div className={cn("mt-6 flex items-baseline gap-3 rounded-2xl px-5 py-4", tone.panel)}>
                  <span data-price-amount className={cn("inline-block text-5xl font-extrabold tracking-tight", tone.amount)}>
                    {tier.price}
                  </span>
                  <span className="text-sm leading-tight text-muted">{tier.priceNote}</span>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} data-price-feature className="flex items-start gap-3 text-[15px] text-body">
                      <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white", tone.check)} aria-hidden>
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={cn(
                    "mt-7 inline-flex h-13 items-center justify-center gap-2.5 rounded-xl px-5 text-base font-semibold transition-colors",
                    featured ? "bg-primary text-on-primary shadow-md hover:bg-primary-hover" : "border border-line bg-surface text-ink hover:border-primary hover:text-primary",
                  )}
                >
                  {tier.id === "boost" && <Mail className="size-5" aria-hidden />}
                  {tier.id === "open-source" && <Image src="/assets/pricing/code.png" alt="" width={28} height={28} className="size-6" />}
                  {label}
                  {tier.id !== "boost" && <ArrowRight className="size-4" aria-hidden />}
                </a>
                {tier.id === "open-source" && (
                  <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center justify-center gap-1.5 break-all text-center text-sm text-primary hover:underline">
                    {githubPath} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                )}
              </article>
            );
            return featured ? (
              <div key={tier.id} data-price-featured className="relative lg:-my-2">
                <div data-price-glow aria-hidden className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-primary/20 opacity-50 blur-2xl" />
                <div className="relative h-full">{card}</div>
              </div>
            ) : (
              <div key={tier.id}>{card}</div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div data-price-note className="flex items-start gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
              <Image src="/assets/pricing/mail.png" alt="" width={64} height={64} className="size-11" />
            </span>
            <p className="text-[15px] text-body">
              <span className="block text-lg font-bold text-ink">How to upgrade</span>
              Email{" "}
              <a href={`mailto:${SITE.adminEmail}`} className="font-semibold text-primary hover:underline">
                {SITE.adminEmail}
              </a>
              . After payment (${BOOST_PACK.priceUsd} per pack), the admin adds your {BOOST_PACK.name} and it appears in your account straight away.
            </p>
          </div>
          <div data-price-note className="flex items-start gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-speaking-soft">
              <Image src="/assets/pricing/open-source.png" alt="" width={64} height={64} className="size-12" />
            </span>
            <p className="text-[15px] text-body">
              <span className="block text-lg font-bold text-ink">Open source</span>
              The code is on{" "}
              <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                GitHub
              </a>{" "}
              for personal, non-commercial use. Using it for a business? Please contact{" "}
              <a href={`mailto:${SITE.adminEmail}`} className="font-semibold text-primary hover:underline">
                {SITE.adminEmail}
              </a>{" "}
              first.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
