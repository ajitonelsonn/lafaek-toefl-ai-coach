"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { WifiOff } from "lucide-react";
import { BRAND } from "@/lib/config/assets";
import { cn } from "@/lib/utils/cn";

type Hint = null | "slow" | "offline";

/** Network Information API (Chromium only); used just to spot very slow connections early. */
type NavigatorWithConnection = Navigator & { connection?: { effectiveType?: string; saveData?: boolean } };

/**
 * Branded loading screen: the LafaekTOEFL crocodile bobs while a ring circles it (GSAP).
 * Fades in only after a short delay so fast loads do not flash, respects reduced motion,
 * and explains slow or missing internet instead of spinning silently.
 */
export function LogoLoader({ label = "Loading…", fullscreen = false, compact = false, className }: { label?: string; fullscreen?: boolean; compact?: boolean; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<Hint>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(el, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.45, delay: 0.15, ease: "back.out(1.6)" });
        gsap.to("[data-ring]", { rotation: 360, duration: 1.6, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
        gsap.to("[data-glow]", { scale: 1.12, opacity: 0.9, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
        const bob = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 0.7, ease: "sine.inOut" } });
        bob.fromTo("[data-mark]", { y: 0, rotation: -3 }, { y: -10, rotation: 3 }, 0).fromTo("[data-shadow]", { scaleX: 1, opacity: 0.35 }, { scaleX: 0.75, opacity: 0.18 }, 0);
        gsap.to("[data-dot]", { y: -5, duration: 0.35, ease: "power1.out", yoyo: true, repeat: -1, stagger: { each: 0.12, repeat: -1, yoyo: true } });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { autoAlpha: 1 });
      });
    }, el);
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, []);

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

  const stage = compact ? "size-24" : "size-44";
  return (
    <div
      ref={root}
      data-loader
      role="status"
      aria-live="polite"
      className={cn("invisible flex flex-col items-center justify-center text-center", fullscreen ? "min-h-dvh bg-page px-4" : compact ? "py-8" : "min-h-[60vh] py-12", className)}
    >
      <div className={cn("relative grid place-items-center", stage)}>
        <span data-glow aria-hidden className="absolute inset-[14%] rounded-full bg-primary-soft opacity-60 blur-xl" />
        <svg data-ring aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="72 217" />
        </svg>
        <span data-shadow aria-hidden className="absolute bottom-[16%] h-2 w-1/2 rounded-full bg-ink/40 blur-[3px]" />
        <Image data-mark src={BRAND.mark.src} alt="" width={BRAND.mark.width} height={BRAND.mark.height} priority className="relative w-[64%] select-none" draggable={false} />
      </div>

      <p className={cn("mt-5 flex items-end gap-1 font-semibold text-ink", compact ? "text-sm" : "text-base")}>
        {label.replace(/…$/, "")}
        <span aria-hidden className="inline-flex gap-0.5 pb-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} data-dot className="size-1.5 rounded-full bg-primary" />
          ))}
        </span>
      </p>

      {hint === "offline" && (
        <p className="mt-3 inline-flex max-w-sm items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-ink">
          <WifiOff className="size-4 shrink-0 text-warning" aria-hidden /> You&apos;re offline. We&apos;ll continue when your internet connection is back.
        </p>
      )}
      {hint === "slow" && <p className="mt-3 max-w-sm text-sm text-muted">Still loading… This can take a little longer on a slow internet connection.</p>}
    </div>
  );
}
