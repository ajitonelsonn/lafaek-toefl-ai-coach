"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "@/lib/client/motion";
import { cn } from "@/lib/utils/cn";

interface Heading {
  depth: 2 | 3;
  id: string;
  text: string;
}

/** "On this page": follows the reader's position with a marker that slides between sections. */
export function DocToc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? "");
  const list = useRef<HTMLUListElement>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = headings[0]?.id ?? "";
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top < 140) current = h.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [headings]);

  useEffect(() => {
    const item = list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    if (!item || !marker.current) return;
    const to = { y: item.offsetTop, height: item.offsetHeight, opacity: 1 };
    if (prefersReducedMotion()) gsap.set(marker.current, to);
    else gsap.to(marker.current, { ...to, duration: 0.35, ease: "power3.out" });
  }, [active]);

  if (!headings.length) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">On this page</p>
      <div className="relative">
        <span ref={marker} className="docs-toc-marker absolute left-0 top-0 w-[3px] rounded-full bg-primary opacity-0" aria-hidden />
        <ul ref={list} className="space-y-0.5 border-l border-line">
          {headings.map((h) => (
            <li key={h.id} data-id={h.id}>
              <a
                href={`#${h.id}`}
                className={cn(
                  "block py-1 pr-2 leading-snug transition-colors",
                  h.depth === 3 ? "pl-7 text-[13px]" : "pl-4",
                  active === h.id ? "font-semibold text-primary" : "text-muted hover:text-ink",
                )}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
