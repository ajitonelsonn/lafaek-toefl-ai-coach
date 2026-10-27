import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { BACKGROUNDS } from "@/lib/config/assets";

export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot Your Password?" subtitle="No problem! Contact the administrator to reset your password." scene={BACKGROUNDS.forgotScene} sceneAlt="The LafaekTOEFL crocodile next to a lock and question mark">
      <ForgotPassword />
    </AuthLayout>
  );
}
