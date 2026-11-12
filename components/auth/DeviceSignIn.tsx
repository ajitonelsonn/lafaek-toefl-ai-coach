"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { formatCode, MAX_DEVICES, normalizeCode } from "@/lib/utils/device-code";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils/cn";

/**
 * Sign in on another device without typing a password (made for Meta Quest, where typing an email
 * and password with a laser pointer is slow). Two ways, both with a short code and a QR code:
 *
 * - ShareCodePanel (signed in): "Use this code on your Quest." The other device opens /link and
 *   types the code, or scans the QR code, and is signed in.
 * - RequestCodePanel (signed out, e.g. on the headset): shows its own code; the learner scans it with
 *   a signed-in phone and taps Approve, and this device signs itself in.
 *
 * EnterCodeForm accepts either kind of code. Codes work once and expire after a few minutes.
 */

const PENDING_KEY = "lafaek:device-code";
const KEY_ICON = { src: "/assets/icons/key.png", width: 65, height: 65 };

interface CodeInfo {
  code: string;
  expiresAt: string;
}

interface DeviceUsage {
  count: number;
  max: number;
  willSignOut: string | null;
}

/** At the 3-device limit: says which device a new sign-in will sign out, with a link to manage them. */
function DeviceLimitNote({ willSignOut, max }: { willSignOut: string | null; max: number }) {
  if (!willSignOut) return null;
  return (
    <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-ink" role="note">
      Your account is already on {max} devices, the limit. Signing in this device will sign out <b>{willSignOut}</b> (used longest ago).{" "}
      <a href="/settings#devices" className="font-semibold text-primary underline">
        Manage devices
      </a>
    </p>
  );
}

/** Full page load after sign-in: the server pages (and the static VR room) read the new cookie. */
function goAfterSignIn(next: string, returnTo?: string) {
  window.location.assign(returnTo ?? next);
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

/** QR code image (drawn in the browser) next to the big readable code and a countdown. */
/** `stacked`: QR code above the code, for narrow cards. */
function CodeCard({ code, url, secondsLeft, caption, stacked }: { code: string; url: string; secondsLeft: number; caption: string; stacked?: boolean }) {
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
  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");
  return (
    <div className={cn("flex flex-col items-center gap-4", !stacked && "sm:flex-row sm:items-center")}>
      <div className="flex size-44 shrink-0 items-center justify-center rounded-2xl border border-line bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn in the browser; nothing to optimise */}
        {qr ? <img src={qr} alt={`QR code that opens the sign-in page with code ${formatCode(code)}`} className="size-full" /> : <span className="size-8 animate-spin rounded-full border-4 border-primary/25 border-t-primary" aria-label="Making QR code" />}
      </div>
      <div className={cn("text-center", !stacked && "sm:text-left")}>
        <p className="text-sm font-semibold text-muted">{caption}</p>
        <p className="mt-1 whitespace-nowrap font-mono text-4xl font-extrabold tracking-[0.12em] text-ink" aria-label={`Code ${code.split("").join(" ")}`}>
          {formatCode(code)}
        </p>
        <p className={cn("mt-2 text-sm font-semibold", secondsLeft < 60 ? "text-warning" : "text-muted")} aria-live="off">
          Expires in {mins}:{secs}
        </p>
      </div>
    </div>
  );
}

/** Signed in: make a one-time code for another device. */
export function ShareCodePanel({ returnTo, stacked }: { returnTo?: string; stacked?: boolean }) {
  const [info, setInfo] = useState<(CodeInfo & { devices?: DeviceUsage }) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const started = useRef(false);
  const secondsLeft = useSecondsLeft(info?.expiresAt ?? null);

  const make = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInfo(await api<CodeInfo & { devices: DeviceUsage }>("/api/auth/device/share", { body: {} }));
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

  const host = typeof window === "undefined" ? "" : window.location.host;
  const expired = info && secondsLeft === 0;
  return (
    <div>
      {info && !expired ? (
        <CodeCard code={info.code} url={linkUrl(info.code, returnTo)} secondsLeft={secondsLeft} caption="Your sign-in code" stacked={stacked} />
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface-soft p-6 text-center">
          {expired ? <p className="font-semibold text-ink">This code has expired.</p> : loading ? <span className="size-8 animate-spin rounded-full border-4 border-primary/25 border-t-primary" aria-label="Making a code" /> : null}
          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {(expired || error) && (
            <Button onClick={make} loading={loading}>
              Make a new code
            </Button>
          )}
        </div>
      )}
      <ol className="mt-5 space-y-2 text-[15px] text-body">
        <li className="flex gap-3">
          <Step n={1} /> <span>On your Meta Quest (or any device), open <b className="text-ink">{host}/link</b> in the browser.</span>
        </li>
        <li className="flex gap-3">
          <Step n={2} /> <span>Type the code. On a phone or tablet you can scan the QR code with the camera instead.</span>
        </li>
      </ol>
      {info?.devices && <DeviceLimitNote willSignOut={info.devices.willSignOut} max={info.devices.max} />}
      <p className="mt-3 text-xs text-muted">The code works once and only for a few minutes. Don&apos;t share it: it opens your account.</p>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">{n}</span>;
}

/** Signed out (e.g. on the headset): show a code, wait for a signed-in device to approve it. */
export function RequestCodePanel({ returnTo }: { returnTo?: string }) {
  const [info, setInfo] = useState<(CodeInfo & { secret: string }) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const started = useRef(false);
  const secondsLeft = useSecondsLeft(info?.expiresAt ?? null);
  const expired = info !== null && secondsLeft === 0;

  const make = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInfo(await api<CodeInfo & { secret: string }>("/api/auth/device/request", { body: {} }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void make();
  }, [make]);

  // Ask every 2.5 s whether the code was approved; the server signs this device in when it was.
  const secret = info?.secret;
  useEffect(() => {
    if (!secret || expired) return;
    let alive = true;
    let busy = false;
    const t = window.setInterval(async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await api<{ status: "pending" | "expired" | "signed_in"; next?: string }>("/api/auth/device/poll", { body: { secret } });
        if (!alive) return;
        if (r.status === "signed_in") {
          alive = false;
          window.clearInterval(t);
          setSigningIn(true);
          goAfterSignIn(r.next ?? "/dashboard", returnTo);
        } else if (r.status === "expired") {
          setInfo((cur) => (cur ? { ...cur, expiresAt: new Date().toISOString() } : cur));
        }
      } catch (e) {
        // A dropped connection just waits for the next tick; a rate limit is worth showing.
        if (alive && e instanceof ApiClientError && e.status === 429) setError(errorMessage(e));
      } finally {
        busy = false;
      }
    }, 2500);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [secret, expired, returnTo]);

  if (signingIn) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl bg-success-soft p-6 text-center" role="status">
        <span className="size-8 animate-spin rounded-full border-4 border-success/25 border-t-success" aria-hidden />
        <p className="text-lg font-bold text-ink">Approved! Signing you in…</p>
      </div>
    );
  }

  const host = typeof window === "undefined" ? "" : window.location.host;
  return (
    <div>
      {info && !expired ? (
        <CodeCard code={info.code} url={linkUrl(info.code)} secondsLeft={secondsLeft} caption="Code for this device" stacked />
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface-soft p-6 text-center">
          {expired ? <p className="font-semibold text-ink">This code has expired.</p> : loading ? <span className="size-8 animate-spin rounded-full border-4 border-primary/25 border-t-primary" aria-label="Making a code" /> : null}
          {(expired || (error && !info)) && (
            <Button onClick={make} loading={loading}>
              Make a new code
            </Button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <p className="mt-4 text-[15px] text-body">
        Scan the QR code with a phone where you are signed in to LafaekTOEFL, then tap <b className="text-ink">Approve</b>. Or open <b className="text-ink">{host}/link</b> on that device and type the code. This page signs in by itself.
      </p>
      {info && !expired && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary" role="status">
          <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden /> Waiting for approval…
        </p>
      )}
    </div>
  );
}

type FormState = { step: "enter" } | { step: "confirm"; device: string; code: string; willSignOut: string | null } | { step: "approved" } | { step: "signing-in" };

/**
 * Type a code (or arrive with one from a scanned QR code via `initialCode`).
 * Signed out: a share code signs this device in. Signed in: a headset's code asks for approval.
 */
export function EnterCodeForm({ signedIn, returnTo, initialCode, compact }: { signedIn: boolean; returnTo?: string; initialCode?: string; compact?: boolean }) {
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : "");
  const [state, setState] = useState<FormState>({ step: "enter" });
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const autoSent = useRef(false);
  const id = useId();

  const send = useCallback(
    async (raw: string, approve?: boolean) => {
      setError("");
      setNeedsLogin(false);
      const clean = normalizeCode(raw);
      if (!clean) return setError("Enter the 8-character code, for example K7QM-3XPA.");
      setLoading(true);
      try {
        const r = await api<{ status: "signed_in" | "confirm" | "approved"; next?: string; device?: string; willSignOut?: string | null }>("/api/auth/device/code", { body: { code: clean, approve } });
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {}
        if (r.status === "signed_in") {
          setState({ step: "signing-in" });
          return goAfterSignIn(r.next ?? "/dashboard", returnTo);
        }
        if (r.status === "confirm") setState({ step: "confirm", device: r.device ?? "Unknown device", code: clean, willSignOut: r.willSignOut ?? null });
        else {
          setState({ step: "approved" });
          setCode("");
        }
      } catch (e) {
        if (e instanceof ApiClientError && e.status === 401) {
          // A headset's code opened on a signed-out phone: sign in here, then come back to approve it.
          setNeedsLogin(true);
          try {
            sessionStorage.setItem(PENDING_KEY, clean);
          } catch {}
        }
        setError(errorMessage(e));
        setState({ step: "enter" });
      } finally {
        setLoading(false);
      }
    },
    [returnTo],
  );

  // Arrived from a QR code: use the code at once (signs in, or shows the approval question).
  useEffect(() => {
    if (!initialCode || autoSent.current) return;
    autoSent.current = true;
    void send(initialCode);
  }, [initialCode, send]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(code);
  };

  if (state.step === "signing-in") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-success-soft p-6 text-center" role="status">
        <span className="size-8 animate-spin rounded-full border-4 border-success/25 border-t-success" aria-hidden />
        <p className="text-lg font-bold text-ink">Signing you in…</p>
      </div>
    );
  }

  if (state.step === "approved") {
    return (
      <div className="rounded-2xl bg-success-soft p-5 text-center" role="status">
        <p className="text-lg font-bold text-ink">Approved</p>
        <p className="mt-1 text-body">Your other device is signing in now. You can close this page.</p>
        <Button variant="ghost" className="mt-3" onClick={() => setState({ step: "enter" })}>
          Approve another device
        </Button>
      </div>
    );
  }

  if (state.step === "confirm") {
    return (
      <div className="rounded-2xl border border-primary/25 bg-primary-soft/60 p-5">
        <p className="text-lg font-bold text-ink">Sign in this device to your account?</p>
        <p className="mt-2 text-body">
          <b className="text-ink">{state.device}</b> is waiting with code <b className="font-mono text-ink">{formatCode(state.code)}</b>.
        </p>
        <p className="mt-2 text-sm text-muted">Only approve a code that is showing on your own device right now. Never approve a code someone sent you.</p>
        <DeviceLimitNote willSignOut={state.willSignOut} max={MAX_DEVICES} />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="lg" loading={loading} onClick={() => send(state.code, true)}>
            Approve
          </Button>
          <Button size="lg" variant="secondary" disabled={loading} onClick={() => setState({ step: "enter" })}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-3", !compact && "sm:flex-row sm:items-start")}>
      <div className="flex-1">
        <label htmlFor={id} className="sr-only">
          {signedIn ? "Code shown on your other device" : "Sign-in code"}
        </label>
        <input
          id={id}
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
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-14 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-center font-mono text-2xl font-extrabold uppercase tracking-[0.18em] text-ink placeholder:font-semibold placeholder:tracking-[0.18em] placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
        />
        {error && (
          <p id={`${id}-error`} className="mt-2 text-sm text-danger" role="alert">
            {error}
            {needsLogin && (
              <>
                {" "}
                <a href="/login?next=/link" className="font-semibold text-primary underline">
                  Sign in
                </a>
              </>
            )}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" loading={loading} className="h-14 px-7 text-lg" disabled={!normalizeCode(code) && !loading}>
        {signedIn ? "Continue" : "Sign in"}
      </Button>
    </form>
  );
}

/**
 * Reads (and then hides) a code from the URL #fragment, or one saved before signing in.
 * `ready` turns true once checked, so a page does not start a new request code needlessly.
 */
export function useArrivingCode(): { ready: boolean; code: string | undefined } {
  const [state, setState] = useState<{ ready: boolean; code: string | undefined }>({ ready: false, code: undefined });
  useEffect(() => {
    let code = normalizeCode(decodeURIComponent(window.location.hash.slice(1))) ?? undefined;
    if (code) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    else {
      try {
        code = normalizeCode(sessionStorage.getItem(PENDING_KEY) ?? "") ?? undefined;
      } catch {}
    }
    setState({ ready: true, code });
  }, []);
  return state;
}

/** The "Sign in on Quest" button on /vr: opens the code window and cancels the code on close. */
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
      <Dialog open={open} onClose={close} title="Sign in on your Quest" size="md" description="No email or password needed on the headset.">
        {open && (
          <div className="space-y-6">
            <ShareCodePanel returnTo={returnTo} />
            <div className="border-t border-line pt-5">
              <p className="mb-3 text-sm font-bold text-ink">Is your Quest already showing a code? Enter it here to approve it.</p>
              <EnterCodeForm signedIn compact />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
