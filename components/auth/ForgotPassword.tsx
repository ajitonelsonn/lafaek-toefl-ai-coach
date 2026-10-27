"use client";

import { useState } from "react";
import { ArrowLeft, Lock, Mail } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { AuthHeading, OrDivider } from "./AuthLayout";

export function ForgotPassword({ adminContact }: { adminContact: string | null }) {
  const [showHelp, setShowHelp] = useState(false);
  const admin = adminContact;
  const mailto = admin ? `mailto:${admin}?subject=${encodeURIComponent("Password reset request — LafaekTOEFL")}` : null;

  return (
    <>
      <AuthHeading title="Forgot Password?" icon={<Lock className="size-9 text-primary" aria-hidden />} subtitle="Please contact the administrator to reset your password." />
      <div className="flex items-start gap-4 rounded-xl bg-primary-soft/70 p-4">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface">
          <Mail className="size-6 text-primary" aria-hidden />
        </span>
        <div>
          <p className="font-bold text-ink">Contact Administrator</p>
          <p className="mt-0.5 text-sm text-body">Send a message to the administrator to request a password reset. Include the email you use to log in.</p>
        </div>
      </div>
      {mailto ? (
        <a href={mailto} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary font-semibold text-on-primary hover:bg-primary-hover">
          <Mail className="size-5" aria-hidden /> Contact Admin
        </a>
      ) : (
        <Button size="lg" fullWidth className="mt-6" leftIcon={<Mail className="size-5" />} onClick={() => setShowHelp(true)} aria-expanded={showHelp} aria-controls="admin-help">
          Contact Admin
        </Button>
      )}
      {showHelp && !mailto && (
        <div id="admin-help" className="mt-4 rounded-xl border border-line bg-surface-soft p-4 text-sm text-body" role="status">
          <p className="font-semibold text-ink">Contact the site administrator</p>
          <p className="mt-1">
            An administrator contact has not been set up for this site yet. Please ask the person or organisation that gave you access to
            LafaekTOEFL to reset your password.
          </p>
        </div>
      )}
      <OrDivider />
      <LinkButton href="/login" variant="secondary" size="lg" fullWidth leftIcon={<ArrowLeft className="size-4" />}>
        Back to Login
      </LinkButton>
    </>
  );
}
