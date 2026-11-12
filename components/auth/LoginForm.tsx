"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Lock, Mail } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { setPendingEmail } from "@/lib/client/pending-email";
import { loginSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { AuthHeading, OrDivider } from "./AuthLayout";
import { GoogleButton } from "./GoogleButton";
import { fieldErrors } from "./field-errors";

/** `returnTo`: an allow-listed page (e.g. the VR room at /vr) to open after login instead of the dashboard. */
export function LoginForm({ returnTo }: { returnTo?: string } = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setLoading(true);
    try {
      const r = await api<{ next: string; needsVerification?: boolean }>("/api/auth/login", { body: parsed.data });
      setPassword("");
      if (r.needsVerification) setPendingEmail(parsed.data.email);
      // /vr is a static page outside the Next.js routes, so it needs a full page load. /link (approving
      // a headset's code) does not need a study plan, so it is the next page either way.
      if (returnTo && !r.needsVerification && (r.next === "/dashboard" || returnTo === "/link")) return window.location.assign(returnTo);
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      setFormError(errorMessage(err));
    }
  };

  return (
    <>
      <AuthHeading title="Welcome Back" subtitle="Log in to your LafaekTOEFL account." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Input label="Email" type="email" autoComplete="email" placeholder="Enter your email" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <div>
          <Input label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" icon={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        {formError && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Log In
        </Button>
      </form>
      <OrDivider />
      <GoogleButton />
      <Link
        href={returnTo === "/vr" ? "/link?next=/vr" : "/link"}
        className="mt-3 flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
      >
        <Image src="/assets/icons/key.png" alt="" width={65} height={65} className="size-6" />
        Sign in with a code (Meta Quest)
      </Link>
      <p className="mt-6 text-center text-sm text-body">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Sign Up
        </Link>
      </p>
    </>
  );
}
