"use client";

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

export function LoginForm() {
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
      <p className="mt-6 text-center text-sm text-body">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Sign Up
        </Link>
      </p>
    </>
  );
}
