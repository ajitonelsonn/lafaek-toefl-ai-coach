"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, Play, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import type { AudioDTO } from "@/lib/practice/dto";
import { api } from "@/lib/client/api";
import { useOptionalSession } from "@/components/session/SessionProvider";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Status = "idle" | "loading" | "playing" | "ended";

interface AudioPlayerProps {
  audio: AudioDTO;
  /** How many times the learner may play the audio. null = unlimited. */
  maxPlays?: number | null;
  onEnded?: () => void;
  label?: string;
  compact?: boolean;
  /** Script revealed after the learner submitted (shown in the transcript panel). */
  revealedScript?: { speaker: string; text: string }[] | null;
  /** Allow the transcript toggle before submission (only works when no audio file exists). */
  transcript?: boolean;
}

const PROVIDER_LABEL: Record<string, string> = { elevenlabs: "ElevenLabs voice" };

/**
 * Plays generated audio files (one per script segment, via short-lived signed URLs).
 * When no file exists yet, it reads the script with the browser's voice and says so.
 */
export function AudioPlayer({ audio, maxPlays = 1, onEnded, label = "Play audio", compact, revealedScript, transcript = true }: AudioPlayerProps) {
  const session = useOptionalSession();
  const sound = session?.settings.sound ?? true;
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [plays, setPlays] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const el = useRef<HTMLAudioElement | null>(null);
  const cancelled = useRef(false);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => setHydrated(true), []);

  const hasFiles = audio.assetIds.length > 0;
  const speechSupported = hydrated && typeof window !== "undefined" && "speechSynthesis" in window;
  const available = hasFiles || (speechSupported && Boolean(audio.script?.length));
  const limitReached = maxPlays !== null && plays >= maxPlays;
  const total = audio.estimatedSeconds;
  const script = revealedScript ?? (hasFiles ? null : audio.script);

  const bars = useMemo(() => {
    let seed = 0;
    for (const ch of `${audio.assetIds.join("")}${audio.script?.[0]?.text ?? ""}`) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    return Array.from({ length: compact ? 32 : 48 }, (_, i) => 30 + Math.round(70 * Math.abs(Math.sin(seed + i * 0.7))));
  }, [audio, compact]);

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
      cancelled.current = true;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      el.current?.pause();
    },
    [],
  );

  const playFiles = async () => {
    setStatus("loading");
    try {
      const urls = await Promise.all(audio.assetIds.map((id) => api<{ url: string }>(`/api/media/${id}/url`).then((r) => r.url)));
      const player = el.current ?? new Audio();
      el.current = player;
      cancelled.current = false;
      setStatus("playing");
      for (const url of urls) {
        if (cancelled.current) return;
        player.src = url;
        await player.play();
        await new Promise<void>((resolve, reject) => {
          player.onended = () => resolve();
          player.onerror = () => reject(new Error("playback"));
        });
      }
      if (!cancelled.current) finish();
    } catch {
      setError("The audio could not be played. Please try again.");
      setStatus("idle");
    }
  };

  const playSpeech = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
    const parts = audio.script ?? [];
    const speakers = [...new Set(parts.map((p) => p.speaker))];
    setStatus("playing");
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part.text);
      u.lang = "en-US";
      u.rate = 0.95;
      const s = speakers.indexOf(part.speaker);
      if (voices.length) u.voice = voices[(s * 3) % voices.length];
      u.pitch = s % 2 === 0 ? 1 : 1.15;
      if (i === parts.length - 1) u.onend = finish;
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        setError("Your browser could not read this audio aloud.");
        setStatus("idle");
      };
      synth.speak(u);
    });
  };

  const play = (force = false) => {
    if (!sound || (!force && limitReached)) return;
    setError(null);
    setElapsed(0);
    setPlays((p) => p + 1);
    if (hasFiles) void playFiles();
    else playSpeech();
  };

  const stop = () => {
    cancelled.current = true;
    el.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStatus("idle");
  };

  const progress = total ? elapsed / total : 0;

  return (
    <div className={cn("rounded-xl border border-line bg-surface-soft", compact ? "p-3" : "p-4")}>
      <div className="flex items-center gap-3 sm:gap-4">
        {status === "playing" || status === "loading" ? (
          <button type="button" onClick={stop} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow hover:bg-primary-hover" aria-label="Stop audio">
            {status === "loading" ? <Loader2 className="size-5 animate-spin" /> : <Square className="size-5 fill-current" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => play()}
            disabled={!available || !sound || limitReached}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-line-strong"
            aria-label={limitReached ? "Audio already played" : label}
          >
            <Play className="ml-0.5 size-5 fill-current" />
          </button>
        )}
        <div className="flex h-10 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className={cn("w-[3px] shrink-0 rounded-full transition-colors", i / bars.length < progress ? "bg-primary" : "bg-primary/25")} style={{ height: `${h}%` }} />
          ))}
        </div>
        <span className="shrink-0 rounded-lg bg-surface px-2 py-1 text-sm font-semibold text-ink tabular-nums">
          {formatClock(elapsed)} / ~{formatClock(total)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Volume2 className="size-3.5" aria-hidden />
          {hasFiles ? `Audio · ${PROVIDER_LABEL[audio.provider ?? ""] ?? "generated voice"}` : "Browser voice preview — recorded audio is not available yet"}
        </span>
        <span className="flex items-center gap-3">
          {maxPlays !== null && <span>{limitReached ? "Played once, like the real test." : `Plays left: ${maxPlays - plays}`}</span>}
          {limitReached && status !== "playing" && (
            <button type="button" onClick={() => play(true)} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <RotateCcw className="size-3.5" aria-hidden /> Replay (practice only)
            </button>
          )}
          {transcript && script && (
            <button type="button" onClick={() => setShowTranscript((s) => !s)} aria-expanded={showTranscript} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <FileText className="size-3.5" aria-hidden /> {showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
          )}
        </span>
      </div>

      {!sound && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-warning">
          <VolumeX className="size-4" aria-hidden /> Sound is turned off.{" "}
          <Link href="/settings" className="font-semibold underline">
            Turn it on in Settings
          </Link>
        </p>
      )}
      {hydrated && !available && <p className="mt-2 text-sm text-warning">This audio cannot be played in this browser yet.</p>}
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {status === "playing" ? "Audio playing." : status === "ended" ? "Audio finished." : ""}
      </span>

      {showTranscript && script && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-body">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Transcript</p>
          <ul className="space-y-1.5">
            {script.map((t, i) => (
              <li key={i}>
                {script.length > 1 && <span className="font-semibold text-ink">{t.speaker}: </span>}
                {t.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
