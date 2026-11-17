"use client";

import Image from "next/image";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";

/**
 * "Try the demo": signs the visitor in as a guest (no account, no typing) and opens the VR Study
 * Room. The guest practises with the demo questions and keeps their own progress for the visit.
 */
export function GuestDemoButton({ next, icon, className }: { next: string; icon: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/guest", { method: "POST", body: {} });
      window.location.assign(next);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" onClick={() => void start()} disabled={busy} className={className}>
        <Image src={icon} alt="" width={36} height={28} className="h-6 w-auto brightness-0 invert" />
        {busy ? "Opening the demo…" : "Try the demo, no account"}
      </button>
      {error && (
        <span className="max-w-xs text-sm text-danger" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
