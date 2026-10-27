import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <>
      <PageHeader title="Profile" description="Manage your account information." icon="profile" />
      <ProfileForm />
    </>
  );
}
