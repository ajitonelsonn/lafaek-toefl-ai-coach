"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** App-wide banner that slides in when the device goes offline and confirms when it is back. */
export function ConnectionStatus() {
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let hideTimer: number | undefined;
    const offline = () => {
      window.clearTimeout(hideTimer);
      setState("offline");
    };
    const online = () => {
      setState("back");
      hideTimer = window.setTimeout(() => setState("online"), 3000);
    };
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (!bar.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = state !== "online";
    // First render: place it instantly (no tween), so nothing can flash on page load.
    const instant = reduce || first.current;
    first.current = false;
    gsap.to(bar.current, { y: show ? 0 : 80, autoAlpha: show ? 1 : 0, duration: instant ? 0 : 0.4, ease: show ? "back.out(1.7)" : "power2.in" });
  }, [state]);

  return (
    <div
      ref={bar}
      role="status"
      aria-live="polite"
      className={cn(
        "invisible fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] translate-y-20 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-card",
        state === "offline" ? "bg-ink text-surface" : "bg-success text-on-primary",
      )}
    >
      {state === "offline" ? <WifiOff className="size-4 shrink-0" aria-hidden /> : <Wifi className="size-4 shrink-0" aria-hidden />}
      {state === "offline" ? "You're offline. Please check your internet connection." : "Back online."}
    </div>
  );
}
