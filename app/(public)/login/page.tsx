import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth/session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Log In" };

/** Pages a login may return to, besides the default. Only exact matches, so it cannot redirect off-site. */
const RETURN_TO = new Set(["/vr", "/link"]);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  const returnTo = next && RETURN_TO.has(next) ? next : undefined;
  if (await getAuth()) redirect(returnTo ?? "/dashboard");
  return (
    <AuthLayout title="Your AI Coach for TOEFL Success" subtitle="Practise smarter, improve faster, achieve your goals." scene={BACKGROUNDS.loginScene} sceneAlt="The LafaekTOEFL crocodile at a laptop next to a login card and Reading, Listening, Speaking and Writing books">
      <LoginForm returnTo={returnTo} />
    </AuthLayout>
  );
}
