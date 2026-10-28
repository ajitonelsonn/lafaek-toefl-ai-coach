"use client";

import { createContext, useContext } from "react";
import type { PracticeProgressDTO } from "@/lib/practice/dto";

/**
 * Saved answers since the last "Start over" and the action that starts over (on the server too),
 * provided by PracticeRunner to the practice session of the open practice type.
 */
interface PracticeProgressValue {
  progress: PracticeProgressDTO;
  startOver: () => Promise<void>;
}

const PracticeProgressContext = createContext<PracticeProgressValue | null>(null);

export const PracticeProgressProvider = PracticeProgressContext.Provider;
export const usePracticeProgress = () => useContext(PracticeProgressContext);
