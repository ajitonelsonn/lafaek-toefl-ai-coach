"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { WifiOff } from "lucide-react";
import { BRAND } from "@/lib/config/assets";
import { cn } from "@/lib/utils/cn";

type Hint = null | "slow" | "offline";

/** Network Information API (Chromium only); used just to spot very slow connections early. */
type NavigatorWithConnection = Navigator & { connection?: { effectiveType?: string; saveData?: boolean } };

const MARK = BRAND.mark;
const SPARKS = 10;

/**
 * Branded loading screen: the LafaekTOEFL crocodile is cut into a grid of pieces that fly in and
 * snap together, shine, flip in a wave, then shatter and fall apart, and the loop starts again with
 * new random paths (GSAP, `repeatRefresh`). The intact logo is shown while it holds, so no seams are
 * visible between pieces. Fades in only after a short delay so fast loads do not flash, shows a still
 * logo under reduced motion, and explains slow or missing internet instead of spinning silently.
 */
export function LogoLoader({ label = "Loading…", fullscreen = false, compact = false, className }: { label?: string; fullscreen?: boolean; compact?: boolean; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<Hint>(null);
  const cols = compact ? 4 : 6;
  const rows = compact ? 3 : 5;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const pieces = gsap.utils.toArray<HTMLElement>("[data-piece]");
        const sparks = gsap.utils.toArray<HTMLElement>("[data-spark]");
        const r = gsap.utils.random;
        // Each piece's offset from the centre, in piece widths/heights, for the shatter direction.
        const dx = (i: number) => (i % cols) + 0.5 - cols / 2;
        const dy = (i: number) => Math.floor(i / cols) + 0.5 - rows / 2;

        gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, delay: 0.15 });
        gsap.fromTo("[data-word]", { clipPath: "inset(0 100% 0 0)", y: 6 }, { clipPath: "inset(0 0% 0 0)", y: 0, duration: 0.9, delay: 0.9, ease: "power3.out" });
        gsap.fromTo("[data-bar]", { xPercent: -100 }, { xPercent: 250, duration: 1.4, ease: "power1.inOut", repeat: -1 });
        gsap.to("[data-ring]", { rotation: 360, duration: 6, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
        gsap.to("[data-dot]", { y: -5, duration: 0.35, ease: "power1.out", stagger: { each: 0.12, repeat: -1, yoyo: true } });

        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.15, repeatRefresh: true, defaults: { overwrite: "auto" } });
        tl.set("[data-whole]", { autoAlpha: 0 })
          // 1. Assemble: pieces fly in from random places and snap together.
          .fromTo(
            pieces,
            { xPercent: () => r(-420, 420), yPercent: () => r(-380, 380), rotation: () => r(-200, 200), scale: () => r(0.2, 0.6), autoAlpha: 0 },
            { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.95, ease: "back.out(1.5)", stagger: { each: 0.022, from: "random" } },
          )
          // 2. Lock in: the whole logo appears (no seams), shines, sparkles burst, the glow pulses.
          .to("[data-whole]", { autoAlpha: 1, duration: 0.12 })
          .fromTo("[data-stage]", { scale: 1 }, { scale: 1.06, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out" }, "<")
          .fromTo("[data-glow]", { scale: 0.85, opacity: 0.4 }, { scale: 1.2, opacity: 0.95, duration: 0.5, yoyo: true, repeat: 1, ease: "sine.inOut" }, "<")
          .fromTo(
            sparks,
            { x: 0, y: 0, scale: 0, autoAlpha: 1 },
            {
              x: (i) => Math.cos((i / SPARKS) * Math.PI * 2) * r(60, 95),
              y: (i) => Math.sin((i / SPARKS) * Math.PI * 2) * r(45, 75),
              scale: () => r(0.6, 1.2),
              autoAlpha: 0,
              duration: 0.75,
              ease: "power2.out",
            },
            "<",
          )
          .fromTo("[data-shine]", { xPercent: -160 }, { xPercent: 160, duration: 0.75, ease: "power2.inOut" }, "<0.05")
          // 3. Swap wave: the pieces flip in a wave across the grid.
          .set("[data-whole]", { autoAlpha: 0 }, "+=0.45")
          .to(pieces, { rotationY: 360, duration: 0.6, ease: "power2.inOut", stagger: { each: 0.035, grid: [rows, cols], from: "start" } })
          .set(pieces, { rotationY: 0 })
          // 4. Break: shatter outwards, re-form, then crack and fall apart (the loop rebuilds it).
          .to(pieces, { xPercent: (i) => dx(i) * r(70, 120), yPercent: (i) => dy(i) * r(70, 120), rotation: () => r(-50, 50), scale: 0.85, duration: 0.45, ease: "power3.out", stagger: { each: 0.008, from: "center" } }, "+=0.2")
          .to(pieces, { xPercent: 0, yPercent: 0, rotation: 0, scale: 1, duration: 0.55, ease: "back.out(1.8)", stagger: { each: 0.012, from: "edges" } })
          .to("[data-whole]", { autoAlpha: 1, duration: 0.1 })
          .set("[data-whole]", { autoAlpha: 0 }, "+=0.5")
          .to(pieces, { yPercent: () => r(260, 420), xPercent: () => r(-60, 60), rotation: () => r(-80, 80), autoAlpha: 0, duration: 0.75, ease: "power2.in", stagger: { each: 0.018, from: "random" } });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { autoAlpha: 1 });
        gsap.set("[data-whole]", { autoAlpha: 1 });
        gsap.set("[data-piece]", { autoAlpha: 0 });
      });
    }, el);
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [cols, rows]);

  useEffect(() => {
    const conn = (navigator as NavigatorWithConnection).connection;
    if (!navigator.onLine) setHint("offline");
    else if (conn && (conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g")) setHint("slow");
    const slowTimer = window.setTimeout(() => setHint((h) => h ?? "slow"), 8000);
    const offline = () => setHint("offline");
    const online = () => setHint((h) => (h === "offline" ? "slow" : h));
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(slowTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  // The logo's own shape masks the shine, so only the crocodile lights up.
  const maskStyle: CSSProperties = { WebkitMaskImage: `url(${MARK.src})`, maskImage: `url(${MARK.src})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };

  return (
    <div
      ref={root}
      data-loader
      role="status"
      aria-live="polite"
      className={cn("invisible flex flex-col items-center justify-center text-center", fullscreen ? "min-h-dvh overflow-hidden bg-page px-4" : compact ? "py-8" : "min-h-[60vh] py-12", className)}
    >
      <div className={cn("relative grid place-items-center", compact ? "size-28" : "size-52")}>
        <span data-glow aria-hidden className="absolute inset-[12%] rounded-full bg-primary/25 opacity-50 blur-2xl" />
        <svg data-ring aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <circle cx="50" cy="50" r="47" fill="none" stroke="var(--line)" strokeWidth="1.2" strokeDasharray="1.5 4" />
          <circle cx="50" cy="3" r="1.8" fill="var(--primary)" />
          <circle cx="97" cy="50" r="1.2" fill="var(--listening)" />
        </svg>

        <div data-stage className="relative w-[70%] perspective-[600px]" style={{ aspectRatio: `${MARK.width} / ${MARK.height}` }}>
          {Array.from({ length: cols * rows }, (_, i) => {
            const c = i % cols;
            const row = Math.floor(i / cols);
            return (
              <span
                key={i}
                data-piece
                aria-hidden
                className="absolute bg-no-repeat will-change-transform backface-hidden"
                style={{
                  left: `${(c * 100) / cols}%`,
                  top: `${(row * 100) / rows}%`,
                  width: `${100 / cols}%`,
                  height: `${100 / rows}%`,
                  backgroundImage: `url(${MARK.src})`,
                  backgroundSize: `${cols * 100}% ${rows * 100}%`,
                  backgroundPosition: `${(c * 100) / (cols - 1)}% ${(row * 100) / (rows - 1)}%`,
                }}
              />
            );
          })}
          <Image data-whole src={MARK.src} alt="" width={MARK.width} height={MARK.height} priority className="invisible absolute inset-0 size-full select-none" draggable={false} />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={maskStyle}>
            <span data-shine className="absolute inset-y-0 left-1/4 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            {Array.from({ length: SPARKS }, (_, i) => (
              <span key={i} data-spark className={cn("absolute size-2 rounded-full opacity-0", i % 3 === 0 ? "bg-warning" : i % 3 === 1 ? "bg-primary" : "bg-listening")} />
            ))}
          </div>
        </div>
      </div>

      {!compact && (
        <Image data-word src={BRAND.wordmark.src} alt="LafaekTOEFL AI Coach" width={BRAND.wordmark.width} height={BRAND.wordmark.height} priority className="mt-3 h-auto w-48 select-none" draggable={false} />
      )}

      <p className={cn("flex items-end gap-1 font-semibold text-ink", compact ? "mt-3 text-sm" : "mt-4 text-base")}>
        {label.replace(/…$/, "")}
        <span aria-hidden className="inline-flex gap-0.5 pb-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} data-dot className="size-1.5 rounded-full bg-primary" />
          ))}
        </span>
      </p>
      {!compact && (
        <div aria-hidden className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-line/70">
          <span data-bar className="block h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>
      )}

      {hint === "offline" && (
        <p className="mt-3 inline-flex max-w-sm items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-ink">
          <WifiOff className="size-4 shrink-0 text-warning" aria-hidden /> You&apos;re offline. We&apos;ll continue when your internet connection is back.
        </p>
      )}
      {hint === "slow" && <p className="mt-3 max-w-sm text-sm text-muted">Still loading… This can take a little longer on a slow internet connection.</p>}
    </div>
  );
}
