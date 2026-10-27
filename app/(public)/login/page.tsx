import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth/session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Log In" };

export default async function LoginPage() {
  if (await getAuth()) redirect("/dashboard");
  return (
    <AuthLayout title="Your AI Coach for TOEFL Success" subtitle="Practise smarter, improve faster, achieve your goals." scene={BACKGROUNDS.loginScene} sceneAlt="The LafaekTOEFL crocodile reading a book next to Reading, Listening, Speaking and Writing books">
      <LoginForm />
    </AuthLayout>
  );
}
