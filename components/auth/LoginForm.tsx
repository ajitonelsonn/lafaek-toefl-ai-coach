"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Lock, Mail } from "lucide-react";
import { services } from "@/lib/services";
import { updateDemo } from "@/lib/store/demo-store";
import { validateLogin, type FieldErrors } from "@/lib/validation/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AuthHeading, DemoAuthNotice, OrDivider } from "./AuthLayout";
import { GoogleButton } from "./GoogleButton";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateLogin({ email, password });
    setErrors(found);
    if (Object.keys(found).length) return;
    setLoading(true);
    const user = await services.auth.signIn({ email: email.trim(), password });
    setPassword("");
    updateDemo((s) => ({ ...s, user: s.user?.email === user.email ? s.user : user }));
    toast(`Welcome back, ${user.name}! (demo sign-in)`);
    router.push("/dashboard");
  };

  return (
    <>
      <AuthHeading title="Welcome Back" subtitle="Log in to your LafaekTOEFL account." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Input label="Email" type="email" autoComplete="email" placeholder="Enter your email" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
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
      <DemoAuthNotice>Demo sign-in: any email and password will work. Nothing is checked or stored on a server, and your password is not saved.</DemoAuthNotice>
    </>
  );
}
