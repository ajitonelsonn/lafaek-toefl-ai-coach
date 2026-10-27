import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsagePage } from "@/components/usage/UsagePage";
import { ILLUSTRATIONS } from "@/lib/config/assets";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getUsage } from "@/lib/server/insights";
import { getAccountPlan } from "@/lib/server/credits";

export const metadata: Metadata = { title: "Usage" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const [d7, d30, all, plan] = await Promise.all([getUsage(user.id, "7d"), getUsage(user.id, "30d"), getUsage(user.id, "all"), getAccountPlan(user.id)]);
  return (
    <>
      <PageHeader title="Usage" description="Your plan, credits left, and your AI and media usage." icon="analytics" art={ILLUSTRATIONS.headerUsage} />
      <UsagePage usage={{ "7d": d7, "30d": d30, all }} plan={plan} />
    </>
  );
}
