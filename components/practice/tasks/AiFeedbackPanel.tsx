"use client";

import { Sparkles } from "lucide-react";
import type { AiFeedbackDTO } from "@/lib/practice/dto";
import { cefrForBand, formatBand } from "@/lib/config/toefl-scale";
import { LoadingWave } from "@/components/ui/MediaLoading";

export type AiFeedback = AiFeedbackDTO;

/** Shown while the AI scores an answer (usually 10–15 seconds). */
export function AiScoring() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary-soft/50 p-4 text-sm font-semibold text-primary" role="status">
      <LoadingWave label="" /> AI is scoring your answer… This usually takes 10–15 seconds.
    </p>
  );
}

/** AI score and coaching. Always labelled as a practice estimate, never as an official score. */
export function AiFeedbackPanel({ feedback, label }: { feedback: AiFeedback; label: string }) {
  return (
    <section aria-label="AI score and coaching" className="rounded-xl border border-primary/25 bg-primary-soft/50 p-4 sm:p-5" role="status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <Sparkles className="size-5 text-primary" aria-hidden /> {feedback.band !== undefined ? "AI score and coaching" : "AI coaching"}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{label}</p>
        </div>
        {feedback.band !== undefined && (
          <p className="rounded-xl bg-surface px-4 py-2 text-center shadow-sm" aria-label={`AI score ${formatBand(feedback.band)} out of 6, CEFR ${cefrForBand(feedback.band)}`}>
            <span className="block text-2xl font-extrabold leading-none text-ink tabular-nums">{formatBand(feedback.band)}</span>
            <span className="text-xs font-semibold text-muted">of 6 · {cefrForBand(feedback.band)}</span>
          </p>
        )}
      </div>
      <p className="mt-3 text-[15px] text-body">{feedback.summary}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-bold text-success">What went well</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-body">
            {feedback.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-warning">Try next time</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-body">
            {feedback.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {feedback.dimensions.map((d) => (
          <div key={d.dimension} className="rounded-lg bg-surface p-3 text-sm">
            <dt className="font-semibold text-ink">{d.dimension}</dt>
            <dd className="text-body">{d.comment}</dd>
          </div>
        ))}
      </dl>
      {feedback.improvedSentence && (
        <p className="mt-4 rounded-lg bg-surface p-3 text-sm text-body">
          <span className="font-semibold text-ink">A stronger sentence: </span>
          {feedback.improvedSentence}
        </p>
      )}
    </section>
  );
}
