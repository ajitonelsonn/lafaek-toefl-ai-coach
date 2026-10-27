import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsagePage } from "@/components/usage/UsagePage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getUsage } from "@/lib/server/insights";

export const metadata: Metadata = { title: "Usage" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const [d7, d30, all] = await Promise.all([getUsage(user.id, "7d"), getUsage(user.id, "30d"), getUsage(user.id, "all")]);
  return (
    <>
      <PageHeader title="Usage" description="See your account's AI and media usage." icon="analytics" art={ILLUSTRATIONS.headerUsage} />
      <UsagePage usage={{ "7d": d7, "30d": d30, all }} />
    </>
  );
}
