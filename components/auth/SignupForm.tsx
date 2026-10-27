"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Lock, Mail, User } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { setPendingEmail } from "@/lib/client/pending-email";
import { signupSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { AuthHeading, OrDivider } from "./AuthLayout";
import { GoogleButton } from "./GoogleButton";
import { fieldErrors } from "./field-errors";

type Field = "name" | "email" | "password" | "confirm";

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<Field | "_", string>>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(values);
    const found: Partial<Record<Field | "_", string>> = parsed.success ? {} : fieldErrors(parsed.error);
    if (values.confirm !== values.password) found.confirm = "The passwords do not match.";
    setErrors(found);
    if (!parsed.success || found.confirm) return;
    setLoading(true);
    try {
      await api("/api/auth/signup", { body: parsed.data });
      setPendingEmail(parsed.data.email);
      setValues((v) => ({ ...v, password: "", confirm: "" }));
      router.push("/verify-email");
    } catch (err) {
      setLoading(false);
      setErrors({ ...(err instanceof ApiClientError && err.fields ? err.fields : {}), _: errorMessage(err) });
    }
  };

  return (
    <>
      <AuthHeading title="Create an Account" subtitle="Sign up to start using LafaekTOEFL." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Input label="Name" autoComplete="name" placeholder="Enter your name" icon={<User />} value={values.name} onChange={set("name")} error={errors.name} />
        <Input label="Email" type="email" autoComplete="email" placeholder="Enter your email" icon={<Mail />} value={values.email} onChange={set("email")} error={errors.email} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          icon={<Lock />}
          value={values.password}
          onChange={set("password")}
          error={errors.password}
          hint="Use at least 8 characters, with letters and a number."
        />
        <Input label="Confirm password" type="password" autoComplete="new-password" placeholder="Type the password again" icon={<Lock />} value={values.confirm} onChange={set("confirm")} error={errors.confirm} />
        {errors._ && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {errors._}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Sign Up
        </Button>
      </form>
      <OrDivider />
      <GoogleButton />
      <p className="mt-6 text-center text-sm text-body">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log In
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted">We&apos;ll email you a 6-digit code to confirm your address.</p>
    </>
  );
}
