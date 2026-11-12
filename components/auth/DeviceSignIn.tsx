"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatCode, normalizeCode } from "@/lib/utils/device-code";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils/cn";

/**
 * Sign in on another device without a password (made for Meta Quest, where typing an email and
 * password with a laser pointer is slow):
 *
 * 1. ShareCodePanel, on a signed-in device: shows a code and QR code.
 * 2. EnterCodeForm, on the new device: the learner types or scans the code; it then waits.
 * 3. ShareCodePanel asks "Meta Quest browser wants to sign in. Approve?" and the learner taps Approve.
 * 4. The new device signs itself in. Without that tap nothing happens, so a seen or guessed code is useless.
 */

const KEY_ICON = { src: "/assets/icons/key.png", width: 65, height: 65 };
const POLL_MS = 2000;

interface DeviceUsage {
  count: number;
  max: number;
  willSignOut: string | null;
}

type ShareStatus =
  | { status: "waiting"; expiresAt: string }
  | { status: "claimed"; device: string; expiresAt: string }
  | { status: "approved" }
  | { status: "signed_in"; device: string }
  | { status: "denied" }
  | { status: "expired" };

/** At the 3-device limit: says which device a new sign-in will sign out, with a link to manage them. */
function DeviceLimitNote({ usage }: { usage?: DeviceUsage }) {
  if (!usage?.willSignOut) return null;
  return (
    <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-ink" role="note">
      Your account is already on {usage.max} devices, the limit. Signing in a new device will sign out <b>{usage.willSignOut}</b> (used longest ago).{" "}
      <a href="/settings#devices" className="font-semibold text-primary underline">
        Manage devices
      </a>
    </p>
  );
}

/** The /link URL for a code. The code goes in the #fragment, which browsers never send to servers or log. */
function linkUrl(code: string, returnTo?: string): string {
  return `${window.location.origin}/link${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}#${code}`;
}

function useSecondsLeft(expiresAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : 0;
}

function Countdown({ secondsLeft, label = "Expires in" }: { secondsLeft: number; label?: string }) {
  return (
    <p className={cn("text-sm font-semibold", secondsLeft < 60 ? "text-warning" : "text-muted")} aria-live="off">
      {label} {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
    </p>
  );
}

function Spinner({ tone = "primary", label }: { tone?: "primary" | "success"; label?: string }) {
  return (
    <span
      className={cn("inline-block size-8 animate-spin rounded-full border-4", tone === "success" ? "border-success/25 border-t-success" : "border-primary/25 border-t-primary")}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** QR code image (drawn in the browser) with the big readable code and a countdown. `stacked`: QR above the code. */
function CodeCard({ code, url, secondsLeft, stacked }: { code: string; url: string; secondsLeft: number; stacked?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#101b4dff", light: "#ffffffff" } })
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className={cn("flex flex-col items-center gap-4", !stacked && "sm:flex-row sm:items-center")}>
      <div className="flex size-44 shrink-0 items-center justify-center rounded-2xl border border-line bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn in the browser; nothing to optimise */}
        {qr ? <img src={qr} alt={`QR code that opens the sign-in page with code ${formatCode(code)}`} className="size-full" /> : <Spinner label="Making QR code" />}
      </div>
      <div className={cn("text-center", !stacked && "sm:text-left")}>
        <p className="text-sm font-semibold text-muted">Your sign-in code</p>
        <p className="mt-1 whitespace-nowrap font-mono text-4xl font-extrabold tracking-[0.12em] text-ink" aria-label={`Code ${code.split("").join(" ")}`}>
          {formatCode(code)}
        </p>
        <div className="mt-2">
          <Countdown secondsLeft={secondsLeft} />
        </div>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">{n}</span>;
}

function Notice({ tone, title, children }: { tone: "success" | "neutral" | "warning"; title: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center",
        tone === "success" ? "bg-success-soft" : tone === "warning" ? "bg-warning-soft" : "border border-dashed border-line bg-surface-soft",
      )}
      role="status"
    >
      <p className="text-lg font-bold text-ink">{title}</p>
      {children}
    </div>
  );
}

/**
 * Signed in: makes a code for another device, then asks the learner to approve the device that
 * enters it. Polls the code's status while open.
 */
export function ShareCodePanel({ returnTo, stacked }: { returnTo?: string; stacked?: boolean }) {
  const [info, setInfo] = useState<{ id: string; code: string; devices: DeviceUsage } | null>(null);
  const [state, setState] = useState<ShareStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState<"approve" | "deny" | null>(null);
  const started = useRef(false);
  const expiresAt = state && "expiresAt" in state ? state.expiresAt : null;
  const secondsLeft = useSecondsLeft(expiresAt);

  const make = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ id: string; code: string; expiresAt: string; devices: DeviceUsage }>("/api/auth/device/share", { body: {} });
      setInfo({ id: r.id, code: r.code, devices: r.devices });
      setState({ status: "waiting", expiresAt: r.expiresAt });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // A ref (kept across React's development double-mount) so only one code is made per opening.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void make();
  }, [make]);

  // Watch for a device entering the code, and for it finishing sign-in after approval.
  const id = info?.id;
  const live = state?.status === "waiting" || state?.status === "claimed" || state?.status === "approved";
  useEffect(() => {
    if (!id || !live) return;
    let alive = true;
    let busy = false;
    const t = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const s = await api<ShareStatus>(`/api/auth/device/share/${id}`);
        if (alive) setState((cur) => (cur && JSON.stringify(cur) === JSON.stringify(s) ? cur : s));
      } catch {
        // A dropped connection just waits for the next tick.
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [id, live]);

  // The countdown reaching zero while waiting means expired, without waiting for the next poll.
  const shown: ShareStatus | null = state && "expiresAt" in state && secondsLeft === 0 ? { status: "expired" } : state;

  const decide = async (approve: boolean) => {
    if (!info) return;
    setDeciding(approve ? "approve" : "deny");
    setError("");
    try {
      await api(`/api/auth/device/share/${info.id}`, { body: { approve } });
      setState(approve ? { status: "approved" } : { status: "denied" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDeciding(null);
    }
  };

  const host = typeof window === "undefined" ? "" : window.location.host;
  const newCodeButton = (label = "Make a new code") => (
    <Button onClick={make} loading={loading}>
      {label}
    </Button>
  );

  let body: ReactNode;
  if (!info || !shown) {
    body = <Notice tone="neutral" title={error ? "Could not make a code" : "Making your code…"}>{error ? newCodeButton("Try again") : <Spinner label="Making a code" />}</Notice>;
  } else if (shown.status === "waiting") {
    body = (
      <>
        <CodeCard code={info.code} url={linkUrl(info.code, returnTo)} secondsLeft={secondsLeft} stacked={stacked} />
        <ol className="mt-5 space-y-2 text-[15px] text-body">
          <li className="flex gap-3">
            <Step n={1} /> <span>On your Meta Quest (or any device), open <b className="text-ink">{host}/link</b> in the browser.</span>
          </li>
          <li className="flex gap-3">
            <Step n={2} /> <span>Type the code. On a phone or tablet you can scan the QR code with the camera instead.</span>
          </li>
          <li className="flex gap-3">
            <Step n={3} /> <span>Come back here and tap <b className="text-ink">Approve</b>.</span>
          </li>
        </ol>
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden /> Waiting for your other device to enter the code…
        </p>
      </>
    );
  } else if (shown.status === "claimed") {
    body = (
      <div className="rounded-2xl border-2 border-primary/40 bg-primary-soft/60 p-5" role="alertdialog" aria-labelledby="approve-title">
        <p id="approve-title" className="text-xl font-extrabold text-ink">
          {shown.device} wants to sign in
        </p>
        <p className="mt-2 text-body">
          A device just entered your code <b className="font-mono text-ink">{formatCode(info.code)}</b>. Approve only if it is your device and you entered the code yourself.
        </p>
        <DeviceLimitNote usage={info.devices} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="lg" loading={deciding === "approve"} disabled={deciding !== null} onClick={() => void decide(true)}>
            Approve
          </Button>
          <Button size="lg" variant="secondary" loading={deciding === "deny"} disabled={deciding !== null} onClick={() => void decide(false)}>
            Deny
          </Button>
          <span className="ml-auto">
            <Countdown secondsLeft={secondsLeft} label="Answer within" />
          </span>
        </div>
      </div>
    );
  } else if (shown.status === "approved") {
    body = (
      <Notice tone="success" title="Approved">
        <Spinner tone="success" />
        <p className="text-body">Your other device is signing in now…</p>
      </Notice>
    );
  } else if (shown.status === "signed_in") {
    body = (
      <Notice tone="success" title={`${shown.device} is signed in`}>
        <p className="text-body">You can close this window.</p>
        <Button variant="secondary" onClick={make} loading={loading}>
          Sign in another device
        </Button>
      </Notice>
    );
  } else if (shown.status === "denied") {
    body = (
      <Notice tone="warning" title="Denied">
        <p className="text-body">That device was not signed in.</p>
        {newCodeButton()}
      </Notice>
    );
  } else {
    body = (
      <Notice tone="neutral" title="This code has expired">
        {newCodeButton()}
      </Notice>
    );
  }

  return (
    <div>
      {body}
      {error && info && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {shown?.status === "waiting" && <DeviceLimitNote usage={info?.devices} />}
      {shown?.status === "waiting" && <p className="mt-3 text-xs text-muted">The code works once, for a few minutes, and nothing is signed in until you approve here.</p>}
    </div>
  );
}

type EnterState = { step: "enter" } | { step: "waiting"; secret: string; expiresAt: string } | { step: "signing-in" };

/**
 * On the new device: type a code (or arrive with one from a scanned QR code via `initialCode`),
 * then wait for the signed-in device to approve.
 */
export function EnterCodeForm({ returnTo, initialCode }: { returnTo?: string; initialCode?: string }) {
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : "");
  const [state, setState] = useState<EnterState>({ step: "enter" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const autoSent = useRef(false);
  const inputId = useId();
  const secondsLeft = useSecondsLeft(state.step === "waiting" ? state.expiresAt : null);

  const send = useCallback(async (raw: string) => {
    setError("");
    const clean = normalizeCode(raw);
    if (!clean) return setError("Enter the 8-character code, for example K7QM-3XPA.");
    setLoading(true);
    try {
      const r = await api<{ secret: string; expiresAt: string }>("/api/auth/device/code", { body: { code: clean } });
      setState({ step: "waiting", secret: r.secret, expiresAt: r.expiresAt });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Arrived from a QR code: send the code at once.
  useEffect(() => {
    if (!initialCode || autoSent.current) return;
    autoSent.current = true;
    void send(initialCode);
  }, [initialCode, send]);

  // Waiting: ask every 2 s whether the signed-in device approved; the server signs this device in when it has.
  const secret = state.step === "waiting" ? state.secret : null;
  useEffect(() => {
    if (!secret) return;
    let alive = true;
    let busy = false;
    const t = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await api<{ status: "pending" | "denied" | "expired" | "signed_in"; next?: string }>("/api/auth/device/poll", { body: { secret } });
        if (!alive) return;
        if (r.status === "signed_in") {
          alive = false;
          window.clearInterval(t);
          setState({ step: "signing-in" });
          // Full page load: the server pages (and the static VR room) read the new cookie.
          window.location.assign(returnTo ?? r.next ?? "/dashboard");
        } else if (r.status === "denied" || r.status === "expired") {
          setState({ step: "enter" });
          setCode("");
          setError(r.status === "denied" ? "The sign-in was denied (or the code window was closed) on your other device. Make a new code there and try again." : "The code expired before it was approved. Make a new code on your signed-in device.");
        }
      } catch (e) {
        if (alive && e instanceof ApiClientError && e.status === 429) setError(errorMessage(e));
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [secret, returnTo]);

  if (state.step === "signing-in") {
    return (
      <Notice tone="success" title="Approved! Signing you in…">
        <Spinner tone="success" />
      </Notice>
    );
  }

  if (state.step === "waiting") {
    return (
      <div className="rounded-2xl border border-primary/25 bg-primary-soft/60 p-6 text-center" role="status">
        <Spinner />
        <p className="mt-3 text-xl font-extrabold text-ink">Waiting for approval</p>
        <p className="mt-2 text-body">
          On the device that showed the code, tap <b className="text-ink">Approve</b>. This page signs in by itself.
        </p>
        <div className="mt-3">
          <Countdown secondsLeft={secondsLeft} label="Time left" />
        </div>
        <Button variant="ghost" className="mt-2" onClick={() => setState({ step: "enter" })}>
          Use a different code
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void send(code);
      }}
      noValidate
      className="flex flex-col gap-3"
    >
      <label htmlFor={inputId} className="sr-only">
        Sign-in code
      </label>
      <input
        id={inputId}
        value={code}
        onChange={(e) => setCode(formatCode(e.target.value))}
        placeholder="K7QM-3XPA"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        maxLength={9}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="h-14 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-center font-mono text-2xl font-extrabold uppercase tracking-[0.18em] text-ink placeholder:font-semibold placeholder:tracking-[0.18em] placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading} className="h-14 text-lg" disabled={!normalizeCode(code) && !loading}>
        Continue
      </Button>
    </form>
  );
}

/**
 * Reads (and then hides) a code from the URL #fragment of a scanned QR code.
 * `ready` turns true once checked, so the page knows whether to auto-send it.
 */
export function useArrivingCode(): { ready: boolean; code: string | undefined } {
  const [state, setState] = useState<{ ready: boolean; code: string | undefined }>({ ready: false, code: undefined });
  useEffect(() => {
    const code = normalizeCode(decodeURIComponent(window.location.hash.slice(1))) ?? undefined;
    if (code) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setState({ ready: true, code });
  }, []);
  return state;
}

/** The "Sign in on Quest" button on /vr: opens the code window; closing it cancels a code not yet approved. */
export function ShareDeviceButton({ returnTo, className }: { returnTo?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    void fetch("/api/auth/device/share", { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => undefined);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Image src={KEY_ICON.src} alt="" width={KEY_ICON.width} height={KEY_ICON.height} className="size-7" />
        Sign in on Quest
      </button>
      <Dialog open={open} onClose={close} title="Sign in on your Quest" size="md" description="No email or password needed on the headset. You approve it here.">
        {open && <ShareCodePanel returnTo={returnTo} />}
      </Dialog>
    </>
  );
}
