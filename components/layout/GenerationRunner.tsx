"use client";

import { useEffect } from "react";
import { getDemoState, updateDemo, useDemoState } from "@/lib/store/demo-store";
import { isActive, stepJobs } from "@/lib/services/mock/generation";

/** Advances the simulated generation jobs while any are queued or running. */
export function GenerationRunner() {
  const { generationJobs } = useDemoState();
  const active = isActive(generationJobs);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (!isActive(getDemoState().generationJobs)) return;
      updateDemo((s) => ({ ...s, generationJobs: stepJobs(s.generationJobs) }));
    }, 1400);
    return () => window.clearInterval(timer);
  }, [active]);
  return null;
}
