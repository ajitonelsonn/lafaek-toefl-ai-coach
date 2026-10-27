"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SKILLS } from "@/lib/config/practice-types";
import { BRAND } from "@/lib/config/assets";
import { gsap, useMotion } from "@/lib/client/motion";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

const STEPS = ["Choosing new questions for you…", "Mixing in your personalised practice…", "Setting the section timers…", "Almost ready. Good luck!"];

/**
 * Shown while a mock test is being prepared (after "Start", and as the session's loading screen).
 * The four section cards are dealt in and shuffle around the crocodile while the steps play.
 */
export function MockTestPreparing({ overlay = false }: { overlay?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1300);
    return () => window.clearInterval(t);
  }, []);

  useMotion(root, (el) => {
    gsap.from(el, { autoAlpha: 0, duration: 0.3 });
    const cards = gsap.utils.toArray<HTMLElement>("[data-prep-card]");
    // Deal the four section cards into a fan, then keep shuffling them gently.
    const fan = [-150, -50, 50, 150];
    const tl = gsap.timeline();
    tl.from("[data-prep-mark]", { scale: 0.6, autoAlpha: 0, duration: 0.5, ease: "back.out(2)" })
      .fromTo(cards, { y: 90, x: 0, rotation: () => gsap.utils.random(-30, 30), autoAlpha: 0 }, { y: 0, x: (i) => fan[i], rotation: (i) => (i - 1.5) * 7, autoAlpha: 1, duration: 0.6, stagger: 0.12, ease: "back.out(1.6)" }, 0.15);
    const shuffle = gsap.timeline({ repeat: -1, repeatDelay: 0.4, delay: 1.1 });
    shuffle
      .to(cards, { y: (i) => (i % 2 ? -14 : 8), duration: 0.35, ease: "sine.inOut", stagger: 0.06 })
      .to(cards, { x: (i) => fan[(i + 1) % 4], rotation: (i) => (((i + 1) % 4) - 1.5) * 7, duration: 0.55, ease: "power2.inOut" })
      .to(cards, { y: 0, duration: 0.3, ease: "sine.out" })
      .to(cards, { x: (i) => fan[i], rotation: (i) => (i - 1.5) * 7, duration: 0.55, ease: "power2.inOut" }, "+=0.3");
    gsap.to("[data-prep-mark]", { y: -8, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.6 });
    gsap.fromTo("[data-prep-bar]", { scaleX: 0 }, { scaleX: 0.92, duration: 5, ease: "power2.out", transformOrigin: "0% 50%" });
  }, []);

  return (
    <div
      ref={root}
      data-loader
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center px-4 text-center", overlay ? "fixed inset-0 z-50 bg-page/95 backdrop-blur-sm" : "min-h-[65vh] py-10")}
    >
      <div className="relative h-56 w-full max-w-md">
        <div data-prep-mark className="absolute left-1/2 top-0 w-28 -translate-x-1/2">
          <Image src={BRAND.mark.src} alt="" width={BRAND.mark.width} height={BRAND.mark.height} priority className="h-auto w-full" />
        </div>
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          {SKILLS.map((s) => (
            <div
              key={s.id}
              data-prep-card
              className={cn("absolute bottom-0 flex h-24 w-20 flex-col items-center justify-center gap-1.5 rounded-xl border-2 bg-surface shadow-card", SKILL_TONE[s.id].border)}
            >
              <SkillIconTile skill={s.id} size="sm" />
              <span className={cn("text-xs font-bold", SKILL_TONE[s.id].text)}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>
      <h2 className="mt-6 text-xl font-extrabold text-ink">Preparing your mock test</h2>
      <p className="mt-1 min-h-6 text-sm text-body">{STEPS[step]}</p>
      <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-line/70" aria-hidden>
        <div data-prep-bar className="h-full rounded-full bg-gradient-to-r from-primary to-listening" />
      </div>
    </div>
  );
}
