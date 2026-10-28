import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth/session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Sign Up" };

export default async function SignupPage() {
  if (await getAuth()) redirect("/dashboard");
  return (
    <AuthLayout title="Create Your Account" subtitle="Join LafaekTOEFL and start practising for a higher TOEFL score." scene={BACKGROUNDS.signupScene} sceneAlt="The LafaekTOEFL crocodile holding a pencil next to a TOEFL skills checklist">
      <SignupForm />
    </AuthLayout>
  );
}
