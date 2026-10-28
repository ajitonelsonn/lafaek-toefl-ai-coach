import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ProfileOverview } from "@/components/account/ProfileOverview";
import { planName } from "@/lib/config/pricing";
import { requireAuthPage } from "@/lib/server/auth/session";
import { getProfileOverview } from "@/lib/server/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function Page() {
  const { user } = await requireAuthPage();
  const overview = await getProfileOverview(user.id);
  return (
    <>
      <PageHeader title="Profile" description="Your account, plan, study goal and achievements." icon="profile" />
      <ProfileForm planLabel={planName(overview.plan)} />
      <ProfileOverview overview={overview} />
    </>
  );
}
