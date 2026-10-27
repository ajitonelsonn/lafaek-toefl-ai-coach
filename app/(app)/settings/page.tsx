import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsForm } from "@/components/account/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your app preferences." icon="settings" />
      <SettingsForm />
    </>
  );
}
