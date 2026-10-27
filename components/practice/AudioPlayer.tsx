"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Play, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import type { MediaRef } from "@/lib/services/types";
import { useDemoState, useHydrated } from "@/lib/store/demo-store";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Status = "idle" | "playing" | "ended";

interface AudioPlayerProps {
  media: MediaRef;
  /** How many times the learner may play the audio. null = unlimited. */
  maxPlays?: number | null;
  onEnded?: () => void;
  label?: string;
  compact?: boolean;
  /** Show the "Show transcript" toggle. */
  transcript?: boolean;
}

function pickVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  return voices.length ? voices : window.speechSynthesis.getVoices();
}

/**
 * Plays a MediaRef. When a real file URL exists it uses <audio>; otherwise
 * (Phase 1) it reads the transcript with the browser's speech voice and says so.
 */
export function AudioPlayer({ media, maxPlays = 1, onEnded, label = "Play audio", compact, transcript = true }: AudioPlayerProps) {
  const hydrated = useHydrated();
  const { settings } = useDemoState();
  const [status, setStatus] = useState<Status>("idle");
  const [plays, setPlays] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const speechSupported = hydrated && typeof window !== "undefined" && "speechSynthesis" in window;
  const canPlayFile = Boolean(media.url);
  const available = canPlayFile || speechSupported;
  const limitReached = maxPlays !== null && plays >= maxPlays;
  const total = media.estimatedSeconds;

  const bars = useMemo(() => {
    let seed = 0;
    for (const ch of media.id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    return Array.from({ length: compact ? 32 : 48 }, (_, i) => 30 + Math.round(70 * Math.abs(Math.sin(seed + i * 0.7))));
  }, [media.id, compact]);

  const finish = useCallback(() => {
    setStatus("ended");
    setElapsed(total);
    onEndedRef.current?.();
  }, [total]);

  useEffect(() => {
    if (status !== "playing") return;
    const t = window.setInterval(() => setElapsed((e) => Math.min(total, e + 0.25)), 250);
    return () => window.clearInterval(t);
  }, [status, total]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      audioRef.current?.pause();
    },
    [],
  );

  const play = (force = false) => {
    if (!settings.sound || (!force && limitReached)) return;
    setError(null);
    setElapsed(0);
    setPlays((p) => p + 1);
    setStatus("playing");

    if (media.url) {
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = media.url;
      el.onended = finish;
      el.onerror = () => {
        setError("The audio file could not be played.");
        setStatus("idle");
      };
      void el.play();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = pickVoices();
    const parts = media.turns?.length ? media.turns : [{ speaker: "", text: media.transcript }];
    const speakers = [...new Set(parts.map((p) => p.speaker))];
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.text);
      u.lang = "en-US";
      u.rate = 0.95;
      const speakerIndex = speakers.indexOf(part.speaker);
      if (voices.length) u.voice = voices[(speakerIndex * 3) % voices.length];
      u.pitch = speakerIndex % 2 === 0 ? 1 : 1.15;
      if (i === parts.length - 1) u.onend = finish;
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        setError("Your browser could not read this audio aloud. Use the transcript instead.");
        setStatus("idle");
      };
      synth.speak(u);
    });
  };

  const stop = () => {
    if (media.url) audioRef.current?.pause();
    else window.speechSynthesis.cancel();
    setStatus("idle");
  };

  const progress = total ? elapsed / total : 0;

  return (
    <div className={cn("rounded-xl border border-line bg-surface-soft", compact ? "p-3" : "p-4")}>
      <div className="flex items-center gap-3 sm:gap-4">
        {status === "playing" ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow hover:bg-primary-hover"
            aria-label="Stop audio"
          >
            <Square className="size-5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => play()}
            disabled={!available || !settings.sound || limitReached}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-line-strong"
            aria-label={limitReached ? "Audio already played" : label}
          >
            <Play className="ml-0.5 size-5 fill-current" />
          </button>
        )}
        <div className="flex h-10 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
          {bars.map((h, i) => (
            <span
              key={i}
              className={cn("w-[3px] shrink-0 rounded-full transition-colors", i / bars.length < progress ? "bg-primary" : "bg-primary/25")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <span className="shrink-0 rounded-lg bg-surface px-2 py-1 text-sm font-semibold text-ink tabular-nums">
          {formatClock(elapsed)} / ~{formatClock(total)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Volume2 className="size-3.5" aria-hidden />
          {media.url ? "Audio file" : "Demo audio — read aloud by your browser voice (no recording yet)"}
        </span>
        <span className="flex items-center gap-3">
          {maxPlays !== null && (
            <span>
              {limitReached ? "Played once, like the real test." : `Plays left: ${maxPlays - plays}`}
            </span>
          )}
          {limitReached && status !== "playing" && (
            <button type="button" onClick={() => play(true)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <RotateCcw className="size-3.5" aria-hidden /> Replay (practice only)
            </button>
          )}
          {transcript && (
            <button
              type="button"
              onClick={() => setShowTranscript((s) => !s)}
              aria-expanded={showTranscript}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <FileText className="size-3.5" aria-hidden /> {showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
          )}
        </span>
      </div>

      {!settings.sound && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-warning">
          <VolumeX className="size-4" aria-hidden /> Sound is turned off.{" "}
          <Link href="/settings" className="font-semibold underline">
            Turn it on in Settings
          </Link>
        </p>
      )}
      {hydrated && !available && <p className="mt-2 text-sm text-warning">This browser cannot play the demo audio. Please use the transcript.</p>}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      <span className="sr-only" aria-live="polite">
        {status === "playing" ? "Audio playing." : status === "ended" ? "Audio finished." : ""}
      </span>

      {showTranscript && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-body">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Transcript</p>
          {media.turns?.length ? (
            <ul className="space-y-1.5">
              {media.turns.map((t, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink">{t.speaker}:</span> {t.text}
                </li>
              ))}
            </ul>
          ) : (
            <p>{media.transcript}</p>
          )}
        </div>
      )}
    </div>
  );
}
