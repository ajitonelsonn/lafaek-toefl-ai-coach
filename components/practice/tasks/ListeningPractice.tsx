"use client";

import Image from "next/image";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { ChooseResponseSet, ListeningSet } from "@/lib/services/types";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { Textarea } from "@/components/ui/Field";
import { AudioPlayer } from "../AudioPlayer";
import { ChoiceSetPractice } from "./ChoiceSetPractice";

function Scene({ scene, title }: { scene: "conversation" | "announcement" | "lecture"; title: string }) {
  if (scene === "lecture") {
    // No licensed lecture image is supplied, so a neutral slide illustration is used.
    return (
      <div className="flex aspect-[2.1/1] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-speaking-soft to-primary-soft text-center" aria-hidden>
        <GraduationCap className="size-12 text-speaking" />
        <p className="text-lg font-bold text-ink">{title}</p>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Academic talk</p>
      </div>
    );
  }
  const img = scene === "conversation" ? ILLUSTRATIONS.conversation : ILLUSTRATIONS.announcement;
  return (
    <Image
      src={img.src}
      alt={scene === "conversation" ? "Illustration of two students talking in a library" : "Campus announcement sign in front of a university building"}
      width={img.width}
      height={img.height}
      className="h-auto w-full rounded-xl object-cover"
    />
  );
}

export function ListeningPractice({ type, content, sampleCount }: { type: PracticeType; content: ListeningSet; sampleCount: number }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const groups = content.items.map((i) => ({ id: i.id, title: i.title, questions: i.questions }));
  return (
    <ChoiceSetPractice
      type={type}
      sampleCount={sampleCount}
      groups={groups}
      listenFirst
      stimulus={(group, { markHeard, resetKey }) => {
        const item = content.items.find((i) => i.id === group.id)!;
        return (
          <div className="flex flex-col gap-4">
            <Scene scene={item.scene} title={item.title} />
            <AudioPlayer key={`${item.id}-${resetKey}`} media={item.audio} onEnded={markHeard} label={`Play: ${item.title}`} />
            {content.kind === "listen-academic-talk" && (
              <Textarea
                label="Your notes (optional)"
                hint="Notes stay on this page only."
                placeholder="Key points, examples, numbers…"
                className="min-h-28"
                value={notes[item.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
              />
            )}
          </div>
        );
      }}
    />
  );
}

export function ChooseResponsePractice({ type, content, sampleCount }: { type: PracticeType; content: ChooseResponseSet; sampleCount: number }) {
  const groups = content.items.map((i) => ({ id: i.id, questions: [i.question] }));
  return (
    <ChoiceSetPractice
      type={type}
      sampleCount={sampleCount}
      groups={groups}
      layout="stacked"
      stimulus={(group, { resetKey }) => {
        const item = content.items.find((i) => i.id === group.id)!;
        return <AudioPlayer key={`${item.id}-${resetKey}`} media={item.audio} label="Play the statement" />;
      }}
    />
  );
}
