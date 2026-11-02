"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/client/motion";

/**
 * Adds behaviour to the server-rendered doc body (#doc-body): copy buttons on code blocks,
 * click-to-enlarge images, a reading progress bar, and a gentle reveal for content below the
 * fold. Content is never hidden before JavaScript runs, and reduced motion keeps it static.
 */
export function DocEnhancer() {
  const bar = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const body = document.getElementById("doc-body");
    if (!body) return;

    for (const block of body.querySelectorAll<HTMLElement>(".docs-code")) {
      const barEl = block.querySelector(".docs-code-bar");
      if (!barEl || barEl.querySelector(".docs-copy")) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "docs-copy";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(block.querySelector("code")?.textContent ?? "");
          btn.textContent = "Copied";
          btn.dataset.copied = "";
        } catch {
          btn.textContent = "Press ⌘C";
        }
        window.setTimeout(() => {
          btn.textContent = "Copy";
          delete btn.dataset.copied;
        }, 1600);
      });
      barEl.appendChild(btn);
    }

    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-zoom]");
      const img = btn?.querySelector("img");
      if (img) setZoom({ src: img.currentSrc || img.src, alt: img.alt });
    };
    body.addEventListener("click", onClick);

    // Reveal blocks that start below the fold as they scroll into view.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const blocks = [...body.querySelectorAll<HTMLElement>(":scope > h2, :scope > h3, .docs-figure, .docs-table, .docs-code, :scope > blockquote")].filter(
        (el) => el.getBoundingClientRect().top > window.innerHeight,
      );
      gsap.set(blocks, { y: 24, autoAlpha: 0 });
      ScrollTrigger.batch(blocks, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.55, ease: "power2.out", stagger: 0.06, overwrite: true }),
      });
    });

    return () => {
      body.removeEventListener("click", onClick);
      mm.revert();
    };
  }, []);

  // Reading progress across the doc body.
  useEffect(() => {
    const body = document.getElementById("doc-body");
    if (!body || !bar.current) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = body.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.2 - rect.top) / Math.max(total, 1)));
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-x-0 top-16 z-30 h-[3px] bg-transparent" aria-hidden>
        <div ref={bar} className="h-full origin-left bg-gradient-to-r from-brand-600 via-brand-500 to-[#7444d6]" style={{ transform: "scaleX(0)" }} />
      </div>
      {zoom && <Lightbox {...zoom} onClose={() => setZoom(null)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (frame.current && !prefersReducedMotion()) gsap.fromTo(frame.current, { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: "back.out(1.4)" });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={alt || "Image"}>
      <button type="button" className="absolute inset-0 cursor-zoom-out bg-brand-950/80 backdrop-blur-sm" aria-label="Close image" onClick={onClose} />
      <div ref={frame} className="relative flex max-h-full max-w-6xl flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- already optimised by /docs/media */}
        <img src={src} alt={alt} className="max-h-[82vh] w-auto rounded-xl bg-surface shadow-2xl" />
        {alt && <p className="mt-3 text-center text-sm font-medium text-white/90">{alt}</p>}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className="absolute -right-3 -top-3 inline-flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-lg hover:text-primary"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
