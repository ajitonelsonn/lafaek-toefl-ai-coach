"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GenerationBatchDTO } from "@/lib/practice/generation-dto";
import { api } from "@/lib/client/api";

const active = (b: GenerationBatchDTO | null) => Boolean(b && b.tasks.some((t) => t.state === "queued" || t.state === "generating"));

/**
 * While personalised content is being generated, polls the real status and
 * refreshes the server-rendered page whenever another task becomes ready.
 */
export function GenerationAutoRefresh({ initial }: { initial: GenerationBatchDTO | null }) {
  const router = useRouter();
  const [batch, setBatch] = useState(initial);
  const readyRef = useRef(initial?.tasks.filter((t) => t.state === "ready").length ?? 0);

  useEffect(() => {
    if (!active(batch)) return;
    const t = window.setInterval(async () => {
      try {
        const r = await api<{ batch: GenerationBatchDTO | null }>("/api/generation/current");
        const ready = r.batch?.tasks.filter((x) => x.state === "ready").length ?? 0;
        if (ready !== readyRef.current) {
          readyRef.current = ready;
          router.refresh();
        }
        setBatch(r.batch);
      } catch {
        /* keep polling */
      }
    }, 8000);
    return () => window.clearInterval(t);
  }, [batch, router]);

  if (!active(batch)) return null;
  const ready = batch!.tasks.filter((t) => t.state === "ready").length;
  return (
    <p className="mb-4 flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-body" role="status">
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
      Generating your personalised questions in the background — {ready} of 12 practice types ready. This page updates automatically.
    </p>
  );
}
