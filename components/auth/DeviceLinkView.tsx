"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { VR_ASSETS } from "@/lib/config/assets";
import { EnterCodeForm, ShareCodePanel, useArrivingCode } from "./DeviceSignIn";

/**
 * The /link page, with large type and buttons for a Quest's laser pointer.
 * Signed out (the new device): enter the code, then wait for approval.
 * Signed in: show a code for another device and approve it here.
 */
export function DeviceLinkView({ signedIn, firstName, returnTo }: { signedIn: boolean; firstName: string | null; returnTo?: string }) {
  const { ready, code } = useArrivingCode();
  const [showShare, setShowShare] = useState(false);
  // A code from a scanned QR code is always for signing this device in, even if it is signed in already.
  const entering = !signedIn || Boolean(code);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#eef4ff] via-page to-page text-body dark:from-[#101b3d]">
      <header className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
        <Logo size={34} />
        {signedIn && firstName && (
          <span className="ml-auto flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-semibold text-ink">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary" aria-hidden>
              {firstName[0]?.toUpperCase()}
            </span>
            {firstName}
          </span>
        )}
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <div className="text-center">
          <Image src={VR_ASSETS.vr.src} alt="" width={VR_ASSETS.vr.width} height={VR_ASSETS.vr.height} className="mx-auto h-10 w-auto" />
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{entering ? "Sign In With a Code" : "Sign In Another Device"}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-body">
            {entering
              ? "No email or password needed. Enter the code shown on a device where you are signed in, then approve on that device."
              : "Show a code here, enter it on your Meta Quest or other device, then approve it here."}
          </p>
        </div>

        {!ready ? (
          <div className="mt-12 flex justify-center" aria-label="Loading">
            <span className="size-10 animate-spin rounded-full border-4 border-primary/25 border-t-primary" />
          </div>
        ) : entering ? (
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Card title={code ? "Your code" : "Enter your code"}>
              <EnterCodeForm returnTo={returnTo} initialCode={code} />
            </Card>
            <Card title="Where do I get a code?">
              <ol className="space-y-3 text-[15px] text-body">
                <HowStep n={1}>
                  On your phone or computer, where you are signed in, open the <b className="text-ink">VR</b> page and choose <b className="text-ink">Sign in on Quest</b>.
                </HowStep>
                <HowStep n={2}>Type the code it shows here (or scan its QR code with this device&apos;s camera).</HowStep>
                <HowStep n={3}>
                  On that phone or computer, tap <b className="text-ink">Approve</b>. This device signs in by itself.
                </HowStep>
              </ol>
            </Card>
            {!signedIn && (
              <p className="text-center text-sm text-muted md:col-span-2">
                Prefer your email and password?{" "}
                <Link href={returnTo ? `/login?next=${returnTo}` : "/login"} className="font-semibold text-primary hover:underline">
                  Log in
                </Link>{" "}
                ·{" "}
                <Link href="/signup" className="font-semibold text-primary hover:underline">
                  Create a free account
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-xl">
            <Card title="Code for your other device">
              {showShare ? (
                <ShareCodePanel returnTo={returnTo} stacked />
              ) : (
                <Button size="lg" fullWidth onClick={() => setShowShare(true)}>
                  Show a sign-in code
                </Button>
              )}
            </Card>
            <p className="mt-5 text-center text-sm">
              <Link href={returnTo ?? "/dashboard"} className="font-semibold text-primary hover:underline">
                {returnTo === "/vr" ? "Back to the VR Study Room" : "Back to my dashboard"}
              </Link>{" "}
              ·{" "}
              <Link href="/settings#devices" className="font-semibold text-primary hover:underline">
                See my signed-in devices
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function HowStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-on-primary">{n}</span>
      <span>{children}</span>
    </li>
  );
}
