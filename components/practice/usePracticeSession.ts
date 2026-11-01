"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { UnitResultDTO } from "@/lib/practice/dto";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/components/ui/Toast";
import { usePracticeProgress } from "./PracticeProgressContext";

export type UnitStatus = "unanswered" | "answered" | "correct" | "incorrect";

/** UI key for a unit: `${itemId}:${unitId}`. */
export const unitKey = (itemId: string, unitId: string) => `${itemId}:${unitId}`;
const splitKey = (key: string) => {
  const i = key.lastIndexOf(":");
  return { itemId: key.slice(0, i), unitId: key.slice(i + 1) };
};

interface Options {
  unitKeys: string[];
  /** False for writing/speaking sets that are not auto-scored. */
  gradable?: boolean;
  /**
   * When one page holds several questions (a Complete the Words passage has 10 blanks), maps a
   * question's position to its page, so the session reopens on the right page.
   */
  pageOf?: (unitIndex: number) => number;
}

/**
 * Practice-set state. Answers live in the browser until checked; checking sends
 * them to the server, which scores them, stores the attempt and returns the result.
 * Answer keys never reach the browser before submission. Answers saved earlier (since the last
 * "Start over") are restored, and the session opens at the first unanswered question.
 */
export function usePracticeSession<A>({ unitKeys, gradable = true, pageOf }: Options) {
  const toast = useToast();
  const ctx = usePracticeProgress();
  const saved = ctx?.progress ?? null;
  const [answers, setAnswers] = useState<Record<string, A>>(() =>
    Object.fromEntries(unitKeys.filter((k) => saved && k in saved.answers).map((k) => [k, saved!.answers[k] as A])),
  );
  const [results, setResults] = useState<Record<string, UnitResultDTO>>(() =>
    Object.fromEntries(unitKeys.filter((k) => saved && k in saved.results).map((k) => [k, saved!.results[k]])),
  );
  const [index, setIndex] = useState(() => {
    const next = unitKeys.findIndex((k) => !(saved && k in saved.results));
    if (next < 0) return 0;
    return pageOf ? pageOf(next) : next;
  });
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const startedAt = useRef(Date.now());

  const answer = useCallback((key: string, value: A | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
    setResults((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** Submits the given answered units (grouped per item) and stores the results. */
  const check = useCallback(
    async (keys: string | string[], fillEmpty?: A): Promise<boolean> => {
      const all = Array.isArray(keys) ? keys : [keys];
      const list = fillEmpty === undefined ? all.filter((k) => k in answers) : all;
      if (!list.length) return true;
      const byItem = new Map<string, { unitId: string; response: unknown }[]>();
      for (const k of list) {
        const { itemId, unitId } = splitKey(k);
        byItem.set(itemId, [...(byItem.get(itemId) ?? []), { unitId, response: k in answers ? answers[k] : fillEmpty }]);
      }
      setPending(true);
      try {
        const merged: Record<string, UnitResultDTO> = {};
        for (const [itemId, responses] of byItem) {
          const r = await api<{ results: Record<string, UnitResultDTO> }>(`/api/practice/items/${itemId}/submit`, {
            body: { responses, durationMs: Date.now() - startedAt.current },
          });
          for (const [unitId, res] of Object.entries(r.results)) merged[unitKey(itemId, unitId)] = res;
        }
        setResults((prev) => ({ ...prev, ...merged }));
        return true;
      } catch (e) {
        toast(errorMessage(e), "warning");
        return false;
      } finally {
        setPending(false);
      }
    },
    [answers, toast],
  );

  /** Stores results produced elsewhere (e.g. the speaking endpoint). */
  const addResults = useCallback((r: Record<string, UnitResultDTO>) => setResults((prev) => ({ ...prev, ...r })), []);

  const toggleFlag = useCallback((key: string) => setFlagged((prev) => ({ ...prev, [key]: !prev[key] })), []);

  const statusOf = useCallback(
    (key: string): UnitStatus => {
      const r = results[key];
      if (r) return r.correct === null ? "answered" : r.correct ? "correct" : "incorrect";
      return key in answers ? "answered" : "unanswered";
    },
    [answers, results],
  );

  const summary = useMemo(() => {
    const done = unitKeys.filter((k) => k in results || k in answers);
    const correct = unitKeys.filter((k) => results[k]?.correct === true).length;
    return { correct: gradable ? correct : null, answered: done.length, total: unitKeys.length };
  }, [answers, gradable, results, unitKeys]);

  const finish = useCallback(async () => {
    const unchecked = unitKeys.filter((k) => k in answers && !(k in results));
    const ok = await check(unchecked);
    if (ok) setFinished(true);
  }, [answers, check, results, unitKeys]);

  const reset = useCallback(() => {
    // "Try again" also starts over on the server, so earlier answers do not come back on reload.
    if (ctx) {
      void ctx.startOver();
      return;
    }
    setAnswers({});
    setResults({});
    setFlagged({});
    setFinished(false);
    setIndex(0);
    setResetKey((k) => k + 1);
    startedAt.current = Date.now();
  }, [ctx]);

  const resetUnits = useCallback((keys: string[]) => {
    const drop = <T,>(obj: Record<string, T>) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
    setAnswers((a) => drop(a));
    setResults((r) => drop(r));
  }, []);

  return { index, setIndex, answers, answer, results, checked: results, check, addResults, pending, flagged, toggleFlag, statusOf, summary, finished, finish, reset, resetUnits, resetKey };
}

export type PracticeSession<A> = ReturnType<typeof usePracticeSession<A>>;
