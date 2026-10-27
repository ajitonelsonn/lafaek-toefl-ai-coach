import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignupPage() {
  return (
    <AuthLayout title="Create Your Account" subtitle="Join LafaekTOEFL and start practising for a higher TOEFL score." scene={BACKGROUNDS.signupScene} sceneAlt="The LafaekTOEFL crocodile waving next to a TOEFL checklist">
      <SignupForm />
    </AuthLayout>
  );
}
