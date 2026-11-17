import type { Metadata } from "next";
import { getAuth } from "@/lib/server/auth/session";
import { safeReturnTo } from "@/lib/utils/device-code";
import { DeviceLinkView } from "@/components/auth/DeviceLinkView";

export const metadata: Metadata = {
  title: "Sign In With a Code",
  description: "Sign in on your Meta Quest or another device with a one-time code or QR code. No password needed.",
  robots: { index: false },
};

/**
 * lafaektoefl.tech/link: short enough to type on a headset. Signed out, it signs this device in with
 * a code from a signed-in device (or shows its own code to approve from a phone). Signed in, it
 * approves a waiting headset or makes a code for another device.
 */
export default async function LinkPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).next);
  const auth = await getAuth().catch(() => null);
  const firstName = auth?.user.displayName?.trim().split(/\s+/)[0] ?? null;
  return <DeviceLinkView signedIn={Boolean(auth)} firstName={firstName} returnTo={returnTo} />;
}
