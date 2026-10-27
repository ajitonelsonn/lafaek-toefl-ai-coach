"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PracticeSlug } from "@/lib/config/practice-types";
import { recordAttempt } from "@/lib/store/demo-store";

export type UnitStatus = "unanswered" | "answered" | "correct" | "incorrect";

interface Options {
  slug: PracticeSlug;
  unitIds: string[];
  /** Returns true/false for gradable units, or null when a unit cannot be auto-graded. */
  grade: (unitId: string, answer: unknown) => boolean | null;
  /** Maps answered unit ids to the ids stored as progress (defaults to the same ids). */
  toProgressIds?: (answeredIds: string[]) => string[];
  /** False for writing/speaking sets that cannot be auto-graded. */
  gradable?: boolean;
}

/** Shared state for a practice set: current unit, answers, checks, flags and completion. */
export function usePracticeSession<A>({ slug, unitIds, grade, toProgressIds, gradable = true }: Options) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, A>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const startedAt = useRef(Date.now());

  const answer = useCallback((unitId: string, value: A | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[unitId];
      else next[unitId] = value;
      return next;
    });
    setChecked((prev) => (prev[unitId] ? { ...prev, [unitId]: false } : prev));
  }, []);

  const check = useCallback((ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setChecked((prev) => ({ ...prev, ...Object.fromEntries(list.map((id) => [id, true])) }));
  }, []);

  const toggleFlag = useCallback((unitId: string) => setFlagged((prev) => ({ ...prev, [unitId]: !prev[unitId] })), []);

  const statusOf = useCallback(
    (unitId: string): UnitStatus => {
      if (!(unitId in answers)) return "unanswered";
      if (!checked[unitId]) return "answered";
      const result = grade(unitId, answers[unitId]);
      if (result === null) return "answered";
      return result ? "correct" : "incorrect";
    },
    [answers, checked, grade],
  );

  const summary = useMemo(() => {
    let correct = 0;
    let answered = 0;
    for (const id of unitIds) {
      if (!(id in answers)) continue;
      answered++;
      if (gradable && grade(id, answers[id]) === true) correct++;
    }
    return { correct: gradable ? correct : null, answered, total: unitIds.length };
  }, [answers, grade, gradable, unitIds]);

  const finish = useCallback(() => {
    setChecked(Object.fromEntries(unitIds.map((id) => [id, true])));
    setFinished(true);
    const answeredIds = unitIds.filter((id) => id in answers);
    recordAttempt(
      {
        slug,
        correct: summary.correct,
        answered: summary.answered,
        total: summary.total,
        durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      },
      toProgressIds ? toProgressIds(answeredIds) : answeredIds,
    );
  }, [answers, slug, summary, toProgressIds, unitIds]);

  const reset = useCallback(() => {
    setAnswers({});
    setChecked({});
    setFlagged({});
    setFinished(false);
    setIndex(0);
    setResetKey((k) => k + 1);
    startedAt.current = Date.now();
  }, []);

  /** Clears answers for some units only (e.g. the current passage). */
  const resetUnits = useCallback((ids: string[]) => {
    const drop = <T,>(obj: Record<string, T>) => Object.fromEntries(Object.entries(obj).filter(([k]) => !ids.includes(k)));
    setAnswers((a) => drop(a));
    setChecked((c) => drop(c));
  }, []);

  return {
    index,
    setIndex,
    answers,
    answer,
    checked,
    check,
    flagged,
    toggleFlag,
    statusOf,
    summary,
    finished,
    finish,
    reset,
    resetUnits,
    resetKey,
  };
}

export type PracticeSession<A> = ReturnType<typeof usePracticeSession<A>>;
