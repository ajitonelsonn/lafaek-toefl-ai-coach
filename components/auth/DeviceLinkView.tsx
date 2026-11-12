"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { VR_ASSETS } from "@/lib/config/assets";
import { EnterCodeForm, RequestCodePanel, ShareCodePanel, useArrivingCode } from "./DeviceSignIn";

/** The /link page. Large type and buttons, so it is easy to use with a Quest's laser pointer. */
export function DeviceLinkView({ signedIn, firstName, returnTo }: { signedIn: boolean; firstName: string | null; returnTo?: string }) {
  const { ready, code } = useArrivingCode();
  const [showShare, setShowShare] = useState(false);

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
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{signedIn ? "Sign In Another Device" : "Sign In With a Code"}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-body">
            {signedIn
              ? "Approve your Meta Quest or another device. It signs in to your account without your email or password."
              : "No email or password needed. Use a code from a device where you are already signed in."}
          </p>
        </div>

        {!ready ? (
          <div className="mt-12 flex justify-center" aria-label="Loading">
            <span className="size-10 animate-spin rounded-full border-4 border-primary/25 border-t-primary" />
          </div>
        ) : signedIn ? (
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            <Card n={1} title="Is your headset showing a code?" hint="Type it here (or scan its QR code with this phone) and approve.">
              <EnterCodeForm signedIn returnTo={returnTo} initialCode={code} compact />
            </Card>
            <Card n={2} title="Or show a code for the other device" hint="Type this code on your Quest at /link, or scan it with a phone.">
              {showShare ? (
                <ShareCodePanel returnTo={returnTo} stacked />
              ) : (
                <Button size="lg" variant="secondary" fullWidth onClick={() => setShowShare(true)}>
                  Show a sign-in code
                </Button>
              )}
            </Card>
            <p className="text-center text-sm md:col-span-2">
              <Link href={returnTo ?? "/dashboard"} className="font-semibold text-primary hover:underline">
                {returnTo === "/vr" ? "Back to the VR Study Room" : "Back to my dashboard"}
              </Link>
            </p>
          </div>
        ) : code ? (
          // Opened from a QR code: sign in right away.
          <div className="mx-auto mt-10 max-w-xl">
            <Card title="Signing in with your code">
              <EnterCodeForm signedIn={false} returnTo={returnTo} initialCode={code} compact />
            </Card>
          </div>
        ) : (
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            <Card n={1} title="Have a code?" hint="On your signed-in phone or computer, open the VR page and choose Sign in on Quest.">
              <EnterCodeForm signedIn={false} returnTo={returnTo} compact />
            </Card>
            <Card n={2} title="Or approve this device from your phone">
              <RequestCodePanel returnTo={returnTo} />
            </Card>
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
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ n, title, hint, children }: { n?: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
      <h2 className="flex items-center gap-3 text-xl font-extrabold text-ink">
        {n && <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base text-on-primary">{n}</span>}
        {title}
      </h2>
      {hint && <p className="mt-2 text-[15px] text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
