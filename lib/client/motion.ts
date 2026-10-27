"use client";

import { useEffect, useLayoutEffect, type DependencyList, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Shared GSAP setup. Every animation runs only when the user has not asked for reduced
// motion, is scoped to one element, and is cleaned up (reverted) on unmount.

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs `setup` inside a gsap.context scoped to `scope` (selector strings match only inside it),
 * only when motion is allowed. Everything it creates is reverted when deps change or on unmount;
 * `setup` may also return its own cleanup (gsap.context calls it on revert).
 */
export function useMotion(scope: RefObject<HTMLElement | SVGElement | null>, setup: (el: HTMLElement | SVGElement) => void | (() => void), deps: DependencyList = []) {
  useIsoLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => setup(el), el);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, deps);
}

/**
 * One-off answer feedback for a just-revealed result box (callback-ref friendly: runs once per
 * element). Correct answers pop; wrong ones give a small horizontal shake.
 */
export function answerFeedback(el: HTMLElement | null, kind: "correct" | "wrong" | "none") {
  if (!el || el.dataset.animated || kind === "none" || prefersReducedMotion()) return;
  el.dataset.animated = "1";
  if (kind === "correct") gsap.fromTo(el, { scale: 0.94, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(2.2)", clearProps: "transform" });
  else gsap.fromTo(el, { x: 0 }, { keyframes: { x: [0, -8, 7, -5, 3, 0] }, duration: 0.45, ease: "power1.out", clearProps: "transform" });
}
