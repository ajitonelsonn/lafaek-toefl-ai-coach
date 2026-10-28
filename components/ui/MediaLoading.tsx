"use client";

import Image from "next/image";
import { useRef } from "react";
import { BRAND } from "@/lib/config/assets";
import { gsap, useMotion } from "@/lib/client/motion";
import { cn } from "@/lib/utils/cn";

// Loading states for media that comes from S3 (pictures and voices), so learners can see that
// something is still on its way. Animations respect reduced motion (the static state still reads).

/** Placeholder while a picture loads: a shimmer sweeps over the card and the crocodile bobs. */
export function ImageLoading({ label = "Loading picture…", className }: { label?: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useMotion(root, () => {
    gsap.fromTo(root.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
    gsap.fromTo("[data-shine]", { xPercent: -120 }, { xPercent: 220, duration: 1.4, ease: "power1.inOut", repeat: -1, repeatDelay: 0.2 });
    gsap.fromTo("[data-mark]", { y: 0, rotation: -4 }, { y: -8, rotation: 4, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to("[data-dot]", { y: -4, duration: 0.35, ease: "power1.out", stagger: { each: 0.12, repeat: -1, yoyo: true } });
  });
  return (
    <div
      ref={root}
      role="status"
      aria-live="polite"
      className={cn("relative flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-primary-soft to-surface-muted", className)}
    >
      <span data-shine aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-surface to-transparent opacity-80" />
      <Image data-mark src={BRAND.mark.src} alt="" width={BRAND.mark.width} height={BRAND.mark.height} className="relative w-20 select-none sm:w-24" draggable={false} />
      <p className="relative flex items-end gap-1 text-sm font-semibold text-ink">
        {label.replace(/…$/, "")}
        <span aria-hidden className="inline-flex gap-0.5 pb-1">
          {[0, 1, 2].map((i) => (
            <span key={i} data-dot className="size-1 rounded-full bg-primary" />
          ))}
        </span>
      </p>
    </div>
  );
}

/** Small equaliser shown while a voice loads (inline, e.g. inside a button or next to a label). */
export function LoadingWave({ className, label = "Loading audio" }: { className?: string; label?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  useMotion(root, () => {
    gsap.fromTo("[data-eq]", { scaleY: 0.3 }, { scaleY: 1, duration: 0.4, ease: "sine.inOut", transformOrigin: "50% 100%", stagger: { each: 0.1, repeat: -1, yoyo: true } });
  });
  return (
    <span ref={root} className={cn("inline-flex h-4 items-end gap-[2px]", className)}>
      {[0.6, 1, 0.75, 0.9].map((h, i) => (
        <span key={i} data-eq aria-hidden className="w-[3px] rounded-full bg-current" style={{ height: `${h * 100}%` }} />
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
}
