"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Lock, Mail, User } from "lucide-react";
import { services } from "@/lib/services";
import { updateDemo } from "@/lib/store/demo-store";
import { validateSignup, type FieldErrors } from "@/lib/validation/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { AuthHeading, DemoAuthNotice, OrDivider } from "./AuthLayout";
import { GoogleButton } from "./GoogleButton";

type Field = "name" | "email" | "password" | "confirm";

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateSignup(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setLoading(true);
    const { email } = await services.auth.signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password });
    // Only the name and email are kept for the OTP step — never the password.
    updateDemo((s) => ({ ...s, pendingSignup: { name: values.name.trim(), email } }));
    setValues((v) => ({ ...v, password: "", confirm: "" }));
    router.push("/verify-email");
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
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Type the password again"
          icon={<Lock />}
          value={values.confirm}
          onChange={set("confirm")}
          error={errors.confirm}
        />
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
      <DemoAuthNotice>Demo sign-up: no account is created and no email is sent. Your password is checked in the form only and is not saved.</DemoAuthNotice>
    </>
  );
}
