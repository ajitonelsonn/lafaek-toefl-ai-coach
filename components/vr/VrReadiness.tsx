"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { VR_ASSETS } from "@/lib/config/assets";
import { cn } from "@/lib/utils/cn";

type State = "checking" | "ready" | "unavailable";

/** Live check: can this browser start an immersive VR session (Meta Quest Browser can)? */
export function VrReadiness() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let alive = true;
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
    if (!xr) {
      setState("unavailable");
      return;
    }
    xr.isSessionSupported("immersive-vr")
      .then((ok) => alive && setState(ok ? "ready" : "unavailable"))
      .catch(() => alive && setState("unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  const ready = state === "ready";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4",
        ready ? "border-success/30 bg-success-soft" : state === "checking" ? "border-line bg-surface-soft" : "border-warning/30 bg-warning-soft",
      )}
    >
      {ready ? (
        <Image src={VR_ASSETS.check.src} alt="" width={40} height={41} className="size-10 shrink-0" />
      ) : (
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold", state === "checking" ? "bg-surface-muted text-muted" : "bg-warning/15 text-warning")} aria-hidden>
          {state === "checking" ? "…" : "!"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-lg font-extrabold", ready ? "text-success" : state === "checking" ? "text-ink" : "text-warning")}>
          {ready ? "VR Ready" : state === "checking" ? "Checking for VR…" : "No VR headset found"}
        </p>
        <p className="text-sm text-body">
          {ready
            ? "Your browser supports immersive VR."
            : state === "checking"
              ? "Looking for a VR headset in this browser."
              : "Open lafaektoefl.tech/vr in the Meta Quest browser to enter VR. You can still preview the room here."}
        </p>
      </div>
      <Image src={VR_ASSETS.vr.src} alt="" width={VR_ASSETS.vr.width} height={VR_ASSETS.vr.height} className="h-auto w-14 shrink-0" />
    </div>
  );
}
