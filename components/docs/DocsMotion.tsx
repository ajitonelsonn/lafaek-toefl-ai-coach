"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/client/motion";

/**
 * GSAP motion for the docs. Every page: the header block ([data-docs-in]) rises in line by line.
 * The overview page also floats the mascot and icons, draws the reading-path line as you
 * scroll, reveals cards and gives the screenshots a light parallax. Renders nothing; with
 * reduced motion everything stays still and visible (see docs.css).
 */
export function DocsMotion({ home = false }: { home?: boolean }) {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-docs-in] > *", { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.07 });
      if (!home) return;

      gsap.fromTo("[data-docs-art]", { scale: 0.85, rotation: -5, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.9, ease: "back.out(1.6)", delay: 0.15 });
      gsap.to("[data-float]", { y: -14, rotation: 1.5, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1 });
      gsap.utils.toArray<HTMLElement>("[data-orbit]").forEach((el, i) => {
        gsap.fromTo(el, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2)", delay: 0.5 + i * 0.12 });
        gsap.to(el, { y: i % 2 ? 10 : -10, x: i % 2 ? -6 : 6, rotation: i % 2 ? -6 : 6, duration: 2.2 + i * 0.35, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1 + i * 0.2 });
      });

      // The dashed path that links the four docs draws itself as the section scrolls by.
      const path = document.querySelector<SVGPathElement>("[data-journey-line]");
      if (path) {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        gsap.to(path, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: "[data-journey]", start: "top 80%", end: "bottom 60%", scrub: 0.6 } });
      }

      const below = (el: HTMLElement) => el.getBoundingClientRect().top > window.innerHeight;
      const reveal = gsap.utils.toArray<HTMLElement>("[data-reveal]").filter(below);
      gsap.set(reveal, { y: 34, autoAlpha: 0 });
      ScrollTrigger.batch(reveal, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.65, ease: "power2.out", stagger: 0.1, overwrite: true }),
      });

      const chips = gsap.utils.toArray<HTMLElement>("[data-chip]").filter(below);
      gsap.set(chips, { scale: 0.7, autoAlpha: 0 });
      ScrollTrigger.batch(chips, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(2)", stagger: 0.06, overwrite: true }),
      });

      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const depth = Number(el.dataset.parallax) || 30;
        gsap.fromTo(el, { y: depth }, { y: -depth, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
    });
    return () => mm.revert();
  }, [home]);

  return null;
}
