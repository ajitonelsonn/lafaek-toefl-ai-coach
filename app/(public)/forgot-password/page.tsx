import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { BACKGROUNDS } from "@/lib/config/assets";
import { env } from "@/lib/server/env";

export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot Your Password?" subtitle="No problem! Contact the administrator to reset your password." scene={BACKGROUNDS.forgotScene} sceneAlt="The LafaekTOEFL crocodile at a laptop next to a lock and a question mark">
      <ForgotPassword adminContact={env().ADMIN_CONTACT_EMAIL ?? null} />
    </AuthLayout>
  );
}
