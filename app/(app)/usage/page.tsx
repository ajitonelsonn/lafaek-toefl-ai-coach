import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsagePage } from "@/components/usage/UsagePage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { services } from "@/lib/services";

export const metadata: Metadata = { title: "Usage" };

export default async function Page() {
  const [d7, d30, all] = await Promise.all([services.usage.getUsage("7d"), services.usage.getUsage("30d"), services.usage.getUsage("all")]);
  return (
    <>
      <PageHeader title="Usage" description="See your account's AI and media usage." icon="analytics" art={ILLUSTRATIONS.headerUsage} />
      <UsagePage summaries={{ "7d": d7, "30d": d30, all }} />
    </>
  );
}
