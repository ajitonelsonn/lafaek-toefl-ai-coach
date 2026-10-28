"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import { BRAND } from "@/lib/config/assets";
import { gsap, prefersReducedMotion, useMotion } from "@/lib/client/motion";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

/** 0 saving recordings · 1 sending answers · 2 scoring Reading and Listening · 3 queuing AI rating · 4 done */
export type SubmitStage = 0 | 1 | 2 | 3 | 4;

const STEPS = ["Saving your spoken answers", "Sending your answers", "Scoring Reading and Listening", "Queuing AI rating for Writing and Speaking"];
/** Percentage reached when each stage starts; the ring creeps towards the next one meanwhile. */
const TARGET = [4, 30, 60, 90, 100];
/** Which skills are handled once a stage is done. */
const DONE_AFTER: Record<SkillId, SubmitStage> = { speaking: 1, reading: 3, listening: 3, writing: 4 };

const R = 54;
const CIRC = 2 * Math.PI * R;

/**
 * Full-screen progress while a mock test is submitted: a percentage ring driven by the real
 * submit stages (it keeps creeping within a stage so it never looks stuck), the steps ticking off,
 * and the four section cards lighting up as their part is handled.
 */
export function MockTestSubmitting({ stage }: { stage: SubmitStage }) {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const value = useRef({ v: 0 });

  useMotion(root, (el) => {
    gsap.from(el, { autoAlpha: 0, duration: 0.3 });
    gsap.from("[data-sub-ring]", { scale: 0.7, autoAlpha: 0, duration: 0.6, ease: "back.out(1.8)" });
    // Explicit end values, then clear the inline styles so the done/waiting classes decide the opacity.
    const settle = "opacity,visibility,transform";
    gsap.fromTo(
      "[data-sub-card]",
      { y: 40, autoAlpha: 0, rotation: () => gsap.utils.random(-14, 14) },
      { y: 0, autoAlpha: 1, rotation: 0, duration: 0.5, stagger: 0.08, ease: "back.out(1.6)", delay: 0.15, clearProps: settle },
    );
    gsap.fromTo("[data-sub-step]", { x: -16, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, stagger: 0.07, delay: 0.3, clearProps: settle });
    gsap.to("[data-sub-mark]", { y: -6, rotation: 3, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }, []);

  // Percentage: tween to the stage's value, then creep towards the next one.
  useEffect(() => {
    const render = () => {
      const v = value.current.v;
      if (pct.current) pct.current.textContent = `${Math.round(v)}%`;
      if (ring.current) ring.current.style.strokeDashoffset = String(CIRC * (1 - v / 100));
    };
    const target = TARGET[stage];
    if (prefersReducedMotion()) {
      value.current.v = target;
      render();
      return;
    }
    let creep: gsap.core.Tween | null = null;
    const tween = gsap.to(value.current, {
      v: target,
      duration: stage === 4 ? 0.6 : 0.9,
      ease: "power2.out",
      onUpdate: render,
      onComplete: () => {
        if (stage < 4) creep = gsap.to(value.current, { v: TARGET[stage + 1] - 3, duration: 9, ease: "power1.out", onUpdate: render });
      },
    });
    return () => {
      tween.kill();
      creep?.kill();
    };
  }, [stage]);

  // Tick off finished steps and light up the sections they cover.
  useEffect(() => {
    if (prefersReducedMotion() || stage === 0) return;
    const done = document.querySelector(`[data-sub-step="${stage - 1}"] [data-sub-check]`);
    if (done) gsap.fromTo(done, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.45, ease: "back.out(3)" });
    const lit = SKILLS.filter((s) => DONE_AFTER[s.id] === stage).map((s) => `[data-sub-card="${s.id}"]`);
    if (lit.length) gsap.fromTo(lit.join(","), { y: 0 }, { y: -12, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.out", stagger: 0.08 });
    if (stage === 4) gsap.fromTo("[data-sub-ring]", { scale: 1 }, { scale: 1.08, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.out" });
  }, [stage]);

  return (
    <div ref={root} role="status" aria-live="polite" className="fixed inset-0 z-50 flex overflow-y-auto bg-page/95 px-4 py-8 backdrop-blur-sm">
      {/* m-auto centres the content but lets it scroll from the top on short screens. */}
      <div className="m-auto flex flex-col items-center text-center">
        <div data-sub-ring className="relative size-48">
          <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
            <defs>
              <linearGradient id="sub-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--primary)" />
                <stop offset="1" stopColor="var(--listening)" />
              </linearGradient>
            </defs>
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle ref={ring} cx="64" cy="64" r={R} fill="none" stroke="url(#sub-ring)" strokeWidth="10" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div data-sub-mark className="w-16">
              <Image src={BRAND.mark.src} alt="" width={BRAND.mark.width} height={BRAND.mark.height} className="h-auto w-full" />
            </div>
            <span ref={pct} className="mt-1 text-3xl font-extrabold tabular-nums text-ink">
              0%
            </span>
          </div>
        </div>

        <h2 className="mt-5 text-xl font-extrabold text-ink">{stage === 4 ? "Test submitted!" : "Submitting your mock test"}</h2>
        <p className="mt-1 text-sm text-body">{stage === 4 ? "Opening your results…" : "Please keep this page open."}</p>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Sections">
          {SKILLS.map((s) => {
            const done = stage >= DONE_AFTER[s.id];
            return (
              <li
                key={s.id}
                data-sub-card={s.id}
                className={cn("flex w-24 flex-col items-center gap-1 rounded-xl border-2 bg-surface px-2 py-2.5 shadow-card", SKILL_TONE[s.id].border, done ? "opacity-100" : "opacity-60")}
              >
                <SkillIconTile skill={s.id} size="sm" />
                <span className={cn("text-xs font-bold", SKILL_TONE[s.id].text)}>{s.title}</span>
                <span className="text-[10px] font-semibold text-muted">{done ? (s.id === "writing" || s.id === "speaking" ? "AI rating next" : "Scored") : "Waiting"}</span>
              </li>
            );
          })}
        </ul>

        <ol className="mt-6 w-full max-w-sm space-y-2 text-left">
          {STEPS.map((label, i) => {
            const state = stage > i ? "done" : stage === i ? "active" : "waiting";
            return (
              <li key={label} data-sub-step={i} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", state === "active" ? "bg-primary-soft font-semibold text-ink" : "text-body", state === "waiting" && "opacity-60")}>
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                    state === "done" ? "bg-success text-white" : state === "active" ? "border-2 border-primary" : "border-2 border-line-strong",
                  )}
                >
                  {state === "done" ? <Check data-sub-check className="size-3.5" strokeWidth={3} aria-hidden /> : state === "active" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : null}
                </span>
                {label}
                <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
