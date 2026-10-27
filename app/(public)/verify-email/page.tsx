import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Verify Email" };

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Verify Your Email" subtitle="We've sent a 6-digit verification code to your email address." scene={BACKGROUNDS.otpScene} sceneAlt="The LafaekTOEFL crocodile next to an envelope with a hidden code">
      <VerifyEmailForm />
    </AuthLayout>
  );
}
