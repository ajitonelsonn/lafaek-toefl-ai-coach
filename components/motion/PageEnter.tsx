"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/client/motion";

/**
 * Soft entrance for app pages. When new page content replaces the old one (an in-app navigation,
 * or the real page arriving after the loading screen), the page header and the columns of the page
 * body fade and rise in with a short stagger. The first server-rendered page is not animated, and
 * the loading screen animates itself.
 */
export function PageEnter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new MutationObserver((records) => {
      if (prefersReducedMotion()) return;
      const added = records.flatMap((r) => Array.from(r.addedNodes)).filter((n): n is HTMLElement => n instanceof HTMLElement && n.parentElement === el);
      if (!added.length || added.some((n) => n.matches("[data-loader]"))) return;
      const body = added.at(-1)!;
      const blocks = body.children.length > 1 ? [...added.slice(0, -1), ...Array.from(body.children)] : added;
      gsap.from(blocks, { y: 16, autoAlpha: 0, duration: 0.45, ease: "power2.out", stagger: 0.07, clearProps: "transform,opacity,visibility" });
    });
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
