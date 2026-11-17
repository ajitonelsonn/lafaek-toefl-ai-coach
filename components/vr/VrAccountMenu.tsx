"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { icon3dSrc } from "@/lib/config/assets";
import { useDismiss } from "@/lib/hooks/useDismiss";

/** The name chip in the /vr header: opens a small menu with Log out. */
export function VrAccountMenu({ firstName }: { firstName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
      // Stay on /vr: signed out it offers Sign in and Sign in with a code (handy on a headset).
      window.location.assign("/vr");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-semibold text-ink transition hover:border-primary/40 hover:bg-surface-muted"
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary" aria-hidden>
          {firstName[0]?.toUpperCase()}
        </span>
        {firstName}
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        <span className="sr-only">Open account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-48 rounded-xl border border-line bg-surface p-2 shadow-xl">
          <button
            role="menuitem"
            type="button"
            onClick={() => void logout()}
            disabled={busy}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            <Image src={icon3dSrc("logout")} alt="" width={22} height={22} className="size-5" />
            {busy ? "Logging out…" : "Log out"}
          </button>
          {error && (
            <p className="px-3 pb-1 pt-2 text-xs text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
