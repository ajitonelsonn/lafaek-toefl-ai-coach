"use client";

import { Megaphone, MessageCircle } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { ReactNode } from "react";
import type { DailyLifeDocument } from "@/lib/services/types";
import type { PracticeView } from "@/lib/practice/dto";
import { ChoiceSetPractice } from "./ChoiceSetPractice";

function DocumentView({ doc }: { doc: DailyLifeDocument }) {
  if (doc.type === "email") {
    return (
      <article aria-label="Email" className="overflow-hidden rounded-xl border-2 border-warning/40 bg-surface">
        <dl className="space-y-2 border-b border-warning/30 bg-warning-soft p-4 text-sm">
          {[
            ["From", doc.from],
            ["To", doc.to],
            ["Subject", doc.subject],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[72px_1fr] items-center gap-2">
              <dt className="font-semibold text-ink">{k}:</dt>
              <dd className="truncate rounded-md border border-line bg-surface px-3 py-1.5 text-body">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-3 p-4 text-[15px] leading-relaxed text-body sm:p-5">
          {doc.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="whitespace-pre-line">{doc.signOff}</p>
        </div>
      </article>
    );
  }
  if (doc.type === "notice") {
    return (
      <article aria-label="Notice" className="rounded-xl border-2 border-primary/30 bg-surface p-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <Megaphone className="size-4" aria-hidden /> Notice
        </p>
        <h2 className="text-lg font-bold text-ink">{doc.heading}</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-body">
          {doc.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {doc.footer && <p className="mt-4 border-t border-line pt-3 text-sm italic text-muted">{doc.footer}</p>}
      </article>
    );
  }
  return (
    <article aria-label="Text messages" className="rounded-xl border border-line bg-surface-soft p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <MessageCircle className="size-4 text-primary" aria-hidden /> {doc.title}
      </p>
      <ul className="space-y-3">
        {doc.messages.map((m, i) => (
          <li key={i} className="rounded-xl bg-surface p-3 shadow-sm">
            <p className="flex justify-between text-xs">
              <span className="font-bold text-ink">{m.sender}</span>
              <span className="text-muted">{m.time}</span>
            </p>
            <p className="mt-1 text-[15px] text-body">{m.text}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

type ReadingView = Extract<PracticeView, { kind: "read-in-daily-life" | "read-academic-passage" }>;

export function ReadingPractice({ type, view, sidebarExtra }: { type: PracticeType; view: ReadingView; sidebarExtra: ReactNode }) {
  const groups = view.items.map((i) => ({ id: i.itemId, title: i.title, source: i.source, questions: i.questions }));
  return (
    <ChoiceSetPractice
      type={type}
      groups={groups}
      sidebarExtra={sidebarExtra}
      stimulus={(group) => {
        const item = view.items.find((i) => i.itemId === group.id)!;
        if (item.document) return <DocumentView doc={item.document} />;
        return (
          <article aria-label={item.title} className="max-h-[560px] overflow-y-auto rounded-xl border border-line bg-surface-soft p-5">
            <h2 className="mb-3 text-lg font-bold text-ink">{item.title}</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-body">
              {item.paragraphs?.map((p, i) => (
                <p key={i}>
                  <span className="mr-1 text-xs font-semibold text-muted">{i + 1}</span>
                  {p}
                </p>
              ))}
            </div>
          </article>
        );
      }}
    />
  );
}
