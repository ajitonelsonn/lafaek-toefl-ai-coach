"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, Mic, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type RecState = "idle" | "requesting" | "recording" | "recorded" | "blocked";

export interface RecordingResult {
  url: string | null;
  simulated: boolean;
  seconds: number;
}

interface RecordingControlProps {
  maxSeconds: number;
  onRecorded?: (result: RecordingResult) => void;
  onCleared?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Records the learner's answer with the browser microphone (MediaRecorder).
 * Audio stays in this tab as an object URL and is never uploaded. When the
 * microphone is unavailable, a clearly labelled simulated recording is offered.
 */
export function RecordingControl({ maxSeconds, onRecorded, onCleared, disabled, disabledReason }: RecordingControlProps) {
  const [state, setState] = useState<RecState>("idle");
  const [remaining, setRemaining] = useState(maxSeconds);
  const [simulated, setSimulated] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const urlRef = useRef<string | null>(null);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      stopTracks();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const complete = useCallback(
    (objectUrl: string | null, wasSimulated: boolean) => {
      const seconds = Math.min(maxSeconds, Math.round((Date.now() - startedAt.current) / 1000));
      urlRef.current = objectUrl;
      setUrl(objectUrl);
      setState("recorded");
      onRecorded?.({ url: objectUrl, simulated: wasSimulated, seconds });
    },
    [maxSeconds, onRecorded],
  );

  const stop = useCallback(() => {
    if (simulated) {
      complete(null, true);
      return;
    }
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, [complete, simulated]);

  useEffect(() => {
    if (state !== "recording") return;
    if (remaining <= 0) {
      stop();
      return;
    }
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [state, remaining, stop]);

  const beginCountdown = (isSimulated: boolean) => {
    setSimulated(isSimulated);
    setRemaining(maxSeconds);
    startedAt.current = Date.now();
    setState("recording");
  };

  const start = async () => {
    const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    if (!supported) {
      setBlockedReason("This browser does not support microphone recording.");
      setState("blocked");
      return;
    }
    setState("requesting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const r = new MediaRecorder(s);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stopTracks();
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        complete(URL.createObjectURL(blob), false);
      };
      recorder.current = r;
      r.start();
      beginCountdown(false);
    } catch {
      setBlockedReason("Microphone access was blocked or no microphone was found.");
      setState("blocked");
    }
  };

  const clear = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setState("idle");
    setRemaining(maxSeconds);
    onCleared?.();
  };

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {state === "recording" ? (
        <>
          <button
            type="button"
            onClick={stop}
            className="recording-pulse inline-flex size-20 items-center justify-center rounded-full bg-danger text-white shadow-lg"
            aria-label="Stop recording"
          >
            <Square className="size-7 fill-current" />
          </button>
          <p className="text-sm font-semibold text-danger" aria-live="polite">
            {simulated ? "Simulated recording" : "Recording"} · {formatClock(remaining)} left
          </p>
          {simulated && <p className="text-xs text-muted">Demo only — no sound is being captured.</p>}
        </>
      ) : state === "recorded" ? (
        <>
          <div className="flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-sm font-semibold text-success">
            <Mic className="size-4" aria-hidden />
            {simulated ? "Simulated response saved (demo)" : "Response recorded"}
          </div>
          {url && <audio controls src={url} className="w-full max-w-xs" aria-label="Your recorded response" />}
          <p className="text-xs text-muted">{simulated ? "No audio was captured." : "Your recording stays in this browser tab and is not uploaded."}</p>
          <Button variant="secondary" size="sm" leftIcon={<RotateCcw className="size-4" />} onClick={clear}>
            Record again
          </Button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={start}
            disabled={disabled || state === "requesting"}
            className={cn(
              "inline-flex size-20 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-8 ring-primary-soft transition-colors hover:bg-primary-hover",
              "disabled:cursor-not-allowed disabled:bg-line-strong disabled:ring-surface-muted",
            )}
            aria-label="Start recording"
          >
            <Mic className="size-8" />
          </button>
          <p className="text-sm text-body">{state === "requesting" ? "Waiting for microphone permission…" : disabled ? disabledReason : "Click to start recording"}</p>
          {state === "blocked" && (
            <div className="w-full max-w-sm rounded-xl bg-warning-soft p-3 text-sm text-body" role="alert">
              <p className="font-semibold text-ink">{blockedReason}</p>
              <p className="mt-1">You can continue with a simulated recording. It does not capture any sound.</p>
              <Button variant="secondary" size="sm" className="mt-2" leftIcon={<FlaskConical className="size-4" />} onClick={() => beginCountdown(true)}>
                Use simulated recording
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
