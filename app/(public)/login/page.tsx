import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Log In" };

export default function LoginPage() {
  return (
    <AuthLayout title="Your AI Coach for TOEFL Success" subtitle="Practise smarter, improve faster, achieve your goals." scene={BACKGROUNDS.loginScene} sceneAlt="The LafaekTOEFL crocodile reading a book next to Reading, Listening, Speaking and Writing books">
      <LoginForm />
    </AuthLayout>
  );
}
