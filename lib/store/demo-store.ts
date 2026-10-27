"use client";

// Browser-only demo state for Phase 1. Holds non-sensitive preferences and
// practice progress in localStorage. Never store passwords, OTP codes, tokens
// or secrets here. A backend can replace this module later.

import { useSyncExternalStore } from "react";
import type { PracticeSlug } from "@/lib/config/practice-types";
import type { AuthUser, GenerationJob, StudyPlan } from "@/lib/services/types";
import { readJSON, removeKey, writeJSON } from "@/lib/utils/storage";

export const STORAGE_KEY = "lafaek-toefl:demo-state:v1";

export type ThemePreference = "light" | "dark" | "system";

export interface PracticeAttempt {
  id: string;
  slug: PracticeSlug;
  completedAt: string;
  /** Number correct for auto-graded tasks; null for writing/speaking. */
  correct: number | null;
  answered: number;
  total: number;
  durationSeconds: number;
}

export interface MockTestResult {
  completedAt: string;
  durationSeconds: number;
  sections: {
    skill: "reading" | "listening" | "writing" | "speaking";
    correct: number | null;
    total: number;
    answered: number;
    note?: string;
  }[];
}

export interface VocabProgress {
  status?: "known" | "review";
  bookmarked?: boolean;
}

export interface DemoState {
  version: 1;
  user: AuthUser | null;
  /** Name and email awaiting OTP confirmation. Never includes the password. */
  pendingSignup: { name: string; email: string } | null;
  settings: { theme: ThemePreference; sound: boolean; reminders: boolean };
  attempts: PracticeAttempt[];
  completedUnits: Partial<Record<PracticeSlug, string[]>>;
  studyPlan: StudyPlan | null;
  /** Daily study-plan task ids completed, keyed by ISO date. */
  dailyDone: Record<string, string[]>;
  generationJobs: GenerationJob[];
  vocab: Record<string, VocabProgress>;
  mockResult: MockTestResult | null;
  drafts: Record<string, { to?: string; subject?: string; body: string }>;
}

export const DEFAULT_STATE: DemoState = {
  version: 1,
  user: null,
  pendingSignup: null,
  settings: { theme: "light", sound: true, reminders: false },
  attempts: [],
  completedUnits: {},
  studyPlan: null,
  dailyDone: {},
  generationJobs: [],
  vocab: {},
  mockResult: null,
  drafts: {},
};

let state: DemoState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const saved = readJSON<Partial<DemoState>>(STORAGE_KEY);
  if (saved && saved.version === 1) {
    state = { ...DEFAULT_STATE, ...saved, settings: { ...DEFAULT_STATE.settings, ...saved.settings } };
  }
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    state = DEFAULT_STATE;
    load();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

function getServerSnapshot() {
  return DEFAULT_STATE;
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getDemoState(): DemoState {
  load();
  return state;
}

export function updateDemo(updater: (prev: DemoState) => DemoState): void {
  load();
  state = updater(state);
  writeJSON(STORAGE_KEY, state);
  listeners.forEach((l) => l());
}

export function resetDemo(keepUser = false): void {
  const user = keepUser ? state.user : null;
  removeKey(STORAGE_KEY);
  state = { ...DEFAULT_STATE, user, settings: state.settings };
  if (user) writeJSON(STORAGE_KEY, state);
  listeners.forEach((l) => l());
}

const noopSubscribe = () => () => {};

/** True after hydration; use to avoid rendering browser-only values on the server. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function recordAttempt(attempt: Omit<PracticeAttempt, "id" | "completedAt">, unitIds: string[]): void {
  updateDemo((s) => {
    const done = new Set([...(s.completedUnits[attempt.slug] ?? []), ...unitIds]);
    const entry: PracticeAttempt = {
      ...attempt,
      id: `${attempt.slug}-${Date.now()}`,
      completedAt: new Date().toISOString(),
    };
    return {
      ...s,
      attempts: [entry, ...s.attempts].slice(0, 100),
      completedUnits: { ...s.completedUnits, [attempt.slug]: [...done] },
    };
  });
}

/** Local calendar date as YYYY-MM-DD. */
export function todayKey(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}
