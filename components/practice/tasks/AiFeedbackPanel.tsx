"use client";

import { Sparkles } from "lucide-react";

export interface AiFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  dimensions: { dimension: string; comment: string }[];
  improvedSentence: string | null;
}

/** AI coaching result. Always labelled as practice feedback, never as an official score. */
export function AiFeedbackPanel({ feedback, label }: { feedback: AiFeedback; label: string }) {
  return (
    <section aria-label="AI coaching" className="rounded-xl border border-primary/25 bg-primary-soft/50 p-4 sm:p-5" role="status">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Sparkles className="size-5 text-primary" aria-hidden /> AI coaching
      </h2>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
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
