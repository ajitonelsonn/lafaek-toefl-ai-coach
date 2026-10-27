"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { clearPendingEmail, getPendingEmail } from "@/lib/client/pending-email";
import { Button, LinkButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatClock } from "@/lib/utils/format";
import { AuthHeading, OrDivider } from "./AuthLayout";
import { cn } from "@/lib/utils/cn";

const LENGTH = 6;

export function VerifyEmailForm() {
  const router = useRouter();
  const toast = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [pendingEmail, setPendingEmailState] = useState<string | null>(null);
  useEffect(() => {
    setPendingEmailState(getPendingEmail());
    setHydrated(true);
  }, []);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const setAt = (i: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Paste of several digits.
      const next = [...digits];
      clean.slice(0, LENGTH - i).split("").forEach((d, j) => (next[i + j] = d));
      setDigits(next);
      inputs.current[Math.min(LENGTH - 1, i + clean.length)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError("");
    if (clean && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < LENGTH) {
      setError("Please enter all 6 digits.");
      inputs.current[digits.findIndex((d) => !d)]?.focus();
      return;
    }
    if (!pendingEmail) {
      setError("We couldn't find your sign-up details. Please sign up again.");
      return;
    }
    setLoading(true);
    try {
      const r = await api<{ next: string }>("/api/auth/verify-email", { body: { email: pendingEmail, code } });
      setDigits(Array(LENGTH).fill(""));
      clearPendingEmail();
      toast("Your email is verified. Welcome!");
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail) return;
    try {
      const r = await api<{ resendAfterSeconds: number }>("/api/auth/resend-otp", { body: { email: pendingEmail } });
      setResendIn(r.resendAfterSeconds);
      toast("If your sign-up is waiting for verification, a new code is on its way.", "info");
    } catch (err) {
      toast(errorMessage(err), "warning");
    }
  };

  return (
    <>
      <AuthHeading
        title="Enter Verification Code"
        icon={<Mail className="size-9 text-primary" aria-hidden />}
        subtitle={
          <>
            We have sent a 6-digit code to
            <span className="mt-1 block font-bold text-ink">{hydrated ? (pendingEmail ?? "your email address") : "…"}</span>
          </>
        }
      />
      {hydrated && !pendingEmail && (
        <p className="mb-5 rounded-lg bg-warning-soft p-3 text-sm text-body" role="alert">
          No sign-up is in progress. Please create an account first.
        </p>
      )}
      <form onSubmit={submit} noValidate>
        <fieldset>
          <legend className="sr-only">Verification code</legend>
          <div className="flex justify-between gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={LENGTH}
                aria-label={`Digit ${i + 1} of ${LENGTH}`}
                aria-invalid={error ? true : undefined}
                className={cn(
                  "h-14 w-full min-w-0 rounded-xl border bg-surface text-center text-2xl font-bold text-ink focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20 sm:h-16",
                  error ? "border-danger" : "border-line-strong",
                )}
              />
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="mt-3 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <p className="mt-5 text-center text-sm text-body">
          Didn&apos;t receive the code?{" "}
          {resendIn > 0 ? (
            <span>
              Resend in <span className="font-bold text-primary tabular-nums">{formatClock(resendIn)}</span>
            </span>
          ) : (
            <button type="button" onClick={resend} className="font-semibold text-primary hover:underline">
              Resend code
            </button>
          )}
        </p>
        <Button type="submit" size="lg" fullWidth className="mt-6" loading={loading}>
          Verify Code
        </Button>
      </form>
      <OrDivider />
      <LinkButton href="/signup" variant="secondary" size="lg" fullWidth leftIcon={<ArrowLeft className="size-4" />}>
        Back to Sign Up
      </LinkButton>
      <p className="mt-4 text-center text-xs text-muted">The code expires in 10 minutes. Check your spam folder if you can&apos;t find it.</p>
    </>
  );
}
