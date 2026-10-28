"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GraduationCap, Megaphone, MessagesSquare } from "lucide-react";
import type { PracticeType } from "@/lib/config/practice-types";
import type { PracticeView } from "@/lib/practice/dto";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { api } from "@/lib/client/api";
import { gsap, prefersReducedMotion } from "@/lib/client/motion";
import { cn } from "@/lib/utils/cn";
import { Textarea } from "@/components/ui/Field";
import { ImageLoading } from "@/components/ui/MediaLoading";
import { AudioPlayer } from "../AudioPlayer";
import { ChoiceSetPractice } from "./ChoiceSetPractice";

type ListeningView = Extract<PracticeView, { kind: "listen-conversation" | "listen-announcement" | "listen-academic-talk" }>;
type ChooseView = Extract<PracticeView, { kind: "listen-choose-response" }>;

/**
 * Generated image (signed URL) when available; otherwise a neutral or starter illustration.
 * While the picture loads from S3 an animated placeholder shows, then the picture fades in.
 */
export function ItemImage({ assetId, fallback, alt }: { assetId: string | null; fallback: ReactNode; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!assetId) return;
    let alive = true;
    setUrl(null);
    setState("loading");
    api<{ url: string }>(`/api/media/${assetId}/url`)
      .then((r) => alive && setUrl(r.url))
      .catch(() => alive && setState("failed"));
    return () => {
      alive = false;
    };
  }, [assetId]);
  if (!assetId || state === "failed") return <>{fallback}</>;

  const loaded = () => {
    setState("ready");
    if (img.current && !prefersReducedMotion()) gsap.fromTo(img.current, { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "power2.out", clearProps: "transform" });
  };
  return (
    <div className="relative w-full">
      {state === "loading" && <ImageLoading />}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; not optimisable by next/image
        <img
          ref={img}
          src={url}
          alt={alt}
          onLoad={loaded}
          onError={() => setState("failed")}
          className={cn("h-auto w-full rounded-xl object-cover", state === "loading" && "pointer-events-none absolute inset-0 opacity-0")}
        />
      )}
    </div>
  );
}

function SceneFallback({ scene, title, source }: { scene: "conversation" | "announcement" | "lecture"; title: string; source: "starter" | "generated" }) {
  // Starter items have hand-picked illustrations; generated items use a neutral card until their image exists.
  if (source === "starter" && scene !== "lecture") {
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
  const Icon = scene === "lecture" ? GraduationCap : scene === "announcement" ? Megaphone : MessagesSquare;
  return (
    <div className="flex aspect-[2.1/1] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-speaking-soft to-primary-soft px-4 text-center" aria-hidden>
      <Icon className="size-12 text-speaking" />
      <p className="text-lg font-bold text-ink">{title}</p>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{scene === "lecture" ? "Academic talk" : scene}</p>
    </div>
  );
}

export function ListeningPractice({ type, view, sidebarExtra }: { type: PracticeType; view: ListeningView; sidebarExtra: ReactNode }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const groups = view.items.map((i) => ({ id: i.itemId, title: i.title, source: i.source, questions: i.questions }));
  return (
    <ChoiceSetPractice
      type={type}
      groups={groups}
      sidebarExtra={sidebarExtra}
      listenFirst
      stimulus={(group, { markHeard, resetKey, revealedScript }) => {
        const item = view.items.find((i) => i.itemId === group.id)!;
        return (
          <div className="flex flex-col gap-4">
            <ItemImage assetId={item.imageAssetId} alt={`Illustration for ${item.title}`} fallback={<SceneFallback scene={item.scene} title={item.title} source={item.source} />} />
            <AudioPlayer key={`${item.itemId}-${resetKey}`} audio={item.audio} onEnded={markHeard} label={`Play: ${item.title}`} revealedScript={revealedScript} />
            {view.kind === "listen-academic-talk" && (
              <Textarea
                label="Your notes (optional)"
                hint="Notes stay on this page only."
                placeholder="Key points, examples, numbers…"
                className="min-h-28"
                value={notes[item.itemId] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [item.itemId]: e.target.value }))}
              />
            )}
          </div>
        );
      }}
    />
  );
}

export function ChooseResponsePractice({ type, view, sidebarExtra }: { type: PracticeType; view: ChooseView; sidebarExtra: ReactNode }) {
  const groups = view.items.map((i) => ({ id: i.itemId, source: i.source, questions: [i.question] }));
  return (
    <ChoiceSetPractice
      type={type}
      groups={groups}
      sidebarExtra={sidebarExtra}
      layout="stacked"
      stimulus={(group, { resetKey, revealedScript }) => {
        const item = view.items.find((i) => i.itemId === group.id)!;
        return <AudioPlayer key={`${item.itemId}-${resetKey}`} audio={item.audio} label="Play the statement" revealedScript={revealedScript} />;
      }}
    />
  );
}
