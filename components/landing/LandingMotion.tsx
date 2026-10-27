"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/client/motion";

/**
 * Landing page motion: the hero text rises in line by line, the crocodile pops in and then
 * floats, and cards below reveal as they scroll into view. Renders nothing; reduced motion
 * keeps the page static (the hero is never pre-hidden in that case, see globals.css).
 */
export function LandingMotion() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .fromTo("[data-hero] > *", { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.09 })
        .fromTo("[data-hero-art]", { scale: 0.85, rotation: -4, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.9, ease: "back.out(1.5)" }, 0.15)
        .from("[data-tagline]", { x: 24, autoAlpha: 0, duration: 0.6 }, 0.7);

      // Gentle idle float for the mascot and a slow sway for the handwritten tagline.
      gsap.to("[data-mascot]", { y: -12, rotation: 1.5, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1 });
      gsap.to("[data-tagline]", { rotation: -5, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.2 });

      // Section headings and cards reveal once as they scroll into view.
      const targets = gsap.utils.toArray<HTMLElement>("#practice h2, #practice article, #study-plan h2, #study-plan article, #about > *");
      gsap.set(targets, { y: 30, autoAlpha: 0 });
      ScrollTrigger.batch(targets, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.6, ease: "power2.out", stagger: 0.08, overwrite: true }),
      });
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set("[data-hero] > *, [data-hero-art]", { autoAlpha: 1 });
    });
    return () => mm.revert();
  }, []);

  return null;
}
