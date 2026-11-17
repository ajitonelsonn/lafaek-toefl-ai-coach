import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ShareDeviceButton } from "@/components/auth/DeviceSignIn";
import { GuestDemoButton } from "@/components/vr/GuestDemoButton";
import { guestDemoEnabled, isGuestEmail } from "@/lib/server/auth/guest";
import { VrAccountMenu } from "@/components/vr/VrAccountMenu";
import { VrReadiness } from "@/components/vr/VrReadiness";
import { VR_ASSETS } from "@/lib/config/assets";
import { getAuth } from "@/lib/server/auth/session";
import { getActivePlan } from "@/lib/server/study-plan";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "VR Study Room",
  description: "Practise 9 TOEFL tasks in VR on Meta Quest (Reading, Listening, Speaking and Build a Sentence) with your own study-plan questions and your hands.",
};

/** The 3D room (IWSDK static build in public/vr/room, source: vr/). */
const ROOM = "/vr/room";
/** This page: where a Quest lands after signing in with a code. */
const ROOM_PAGE = "/vr";
const KEY_ICON = { src: "/assets/icons/key.png", width: 65, height: 65 };

/** The four VR zones and their activities. Write an Email and Academic Discussion stay on the website. */
const ZONES = [
  {
    id: "reading",
    title: "Reading",
    icon: VR_ASSETS.zoneReading,
    tone: "from-[#e8f0ff] to-[#f1ecff] dark:from-[#14284f] dark:to-[#251f47]",
    tasks: ["Read in Daily Life", "Read an Academic Passage"],
  },
  {
    id: "listening",
    title: "Listening",
    icon: VR_ASSETS.zoneListening,
    tone: "from-[#e5f0ff] to-[#eef6ff] dark:from-[#14284f] dark:to-[#18264a]",
    tasks: ["Listen and Choose a Response", "Listen to a Conversation", "Listen to an Announcement", "Listen to an Academic Talk"],
  },
  {
    id: "speaking",
    title: "Speaking",
    icon: VR_ASSETS.zoneSpeaking,
    tone: "from-[#f1ecff] to-[#e9f0ff] dark:from-[#251f47] dark:to-[#1a2550]",
    tasks: ["Listen and Repeat", "Take an Interview"],
  },
  {
    id: "writing",
    title: "Writing",
    icon: VR_ASSETS.zoneWriting,
    tone: "from-[#fff0e8] to-[#f3eeff] dark:from-[#3a2420] dark:to-[#26204a]",
    tasks: ["Build a Sentence with 3D word tiles"],
  },
] as const;

type Access = "signed-out" | "no-plan" | "ready";

export default async function VrPage() {
  const auth = await getAuth().catch(() => null);
  const plan = auth ? await getActivePlan(auth.user.id).catch(() => null) : null;
  // A guest (the "Try the demo" button) practises with the demo questions, so needs no plan.
  const guest = !!auth && isGuestEmail(auth.user.emailNormalized);
  const access: Access = !auth ? "signed-out" : plan || guest ? "ready" : "no-plan";
  const demo = !auth && (await guestDemoEnabled().catch(() => false));
  const firstName = auth?.user.displayName?.trim().split(/\s+/)[0] ?? null;

  // Where the main button and the task cards lead, depending on the learner's state.
  const primary =
    access === "ready"
      ? { href: ROOM, label: "Enter VR Study Room", external: true }
      : access === "no-plan"
        ? { href: "/study-plan", label: "Create my study plan", external: false }
        : { href: "/login?next=/vr", label: "Sign in to start", external: false };
  const secondary =
    access === "ready"
      ? { href: `${ROOM}?mode=preview`, label: "Preview in Browser", external: true }
      : access === "no-plan"
        ? { href: "/dashboard", label: "Back to dashboard", external: false }
        : { href: "/link?next=/vr", label: "Sign in with a code", external: false };
  const secondaryIcon = access === "ready" ? VR_ASSETS.desktop : access === "signed-out" ? KEY_ICON : null;

  return (
    <div className="min-h-dvh bg-page text-body">
      <VrHeader firstName={firstName} guest={guest} />

      <main id="main">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <Image
            src={VR_ASSETS.background.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[70%_center] opacity-90 dark:opacity-40"
          />
          {/* Fade the scene into the page on the left (text side) and at the bottom. */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-page via-page/85 to-page/10 lg:via-page/70 lg:to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-page to-transparent" aria-hidden />

          <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pb-6 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pb-2 lg:pt-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface/80 px-4 py-1.5 text-sm font-bold text-primary shadow-sm backdrop-blur">
                <Image src={VR_ASSETS.vr.src} alt="" width={28} height={16} className="h-4 w-7" /> Lafaek VR Study Room
              </p>
              <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl">
                Your TOEFL Journey,
                <br />
                Now{" "}
                <span className="relative inline-block italic text-primary">
                  in VR
                  <svg className="absolute -bottom-2 left-0 h-3 w-full text-primary" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden>
                    <path d="M2 9 C 30 2, 70 2, 98 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
                .
              </h1>
              <p className="mt-6 max-w-xl text-lg text-body">
                Step into your personal virtual study room and practise TOEFL skills in an immersive, interactive, and fun environment.
              </p>
              {access !== "ready" && (
                <p className="mt-4 max-w-xl rounded-xl border border-primary/20 bg-primary-soft/80 px-4 py-3 text-sm font-medium text-ink">
                  {access === "signed-out"
                    ? demo
                      ? "Try the demo with sample questions, no account needed. Or sign in to practise with the questions from your own study plan."
                      : "The study room uses the questions from your own study plan. Sign in, or create a free account and a study plan first."
                    : `Hi ${firstName ?? "there"}! Create your study plan first. The study room uses the questions made for your plan.`}
                </p>
              )}

              {guest && (
                <p className="mt-4 max-w-xl rounded-xl border border-primary/20 bg-primary-soft/80 px-4 py-3 text-sm font-medium text-ink">
                  You are trying the demo as a guest, with sample questions. <Link href="/signup" className="font-bold text-primary hover:underline">Create a free account</Link> to get your own study plan and keep your progress.
                </p>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                {/* No account needed: one tap signs a visitor in as a guest and opens the room. */}
                {demo && <GuestDemoButton next={ROOM} icon={VR_ASSETS.vr.src} className={ctaClass("primary")} />}
                <CtaLink {...primary} variant={demo ? "secondary" : "primary"} icon={access === "ready" ? VR_ASSETS.vr : null} />
                <CtaLink {...secondary} variant="secondary" icon={secondaryIcon} />
                {/* Signed in here (phone or computer): a one-time code / QR code signs the Quest in. */}
                {access !== "signed-out" && !guest && <ShareDeviceButton returnTo={ROOM_PAGE} className={ctaClass("secondary")} />}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                {/* A guest leaves through the exit route, which signs them out on the way. */}
                <Link href={guest ? "/api/auth/guest/exit?next=/" : "/dashboard"} prefetch={false} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  <Image src={VR_ASSETS.back.src} alt="" width={22} height={22} className="size-5" /> {guest ? "Leave the demo" : "Back to LafaekTOEFL"}
                </Link>
                {access === "signed-out" && (
                  <Link href="/signup" className="text-sm font-bold text-primary hover:underline">
                    New here? Create a free account
                  </Link>
                )}
              </div>
            </div>

            {/* The mascot in an unbranded VR headset, overlapping the study-room scene. */}
            <div className="relative mx-auto w-full max-w-[470px] lg:-ml-10 lg:mr-auto">
              <div className="absolute inset-[12%] rounded-full bg-primary/15 blur-3xl" aria-hidden />
              <Image
                src={VR_ASSETS.mascot.src}
                alt="The LafaekTOEFL crocodile mascot wearing a VR headset, giving a thumbs-up"
                width={VR_ASSETS.mascot.width}
                height={VR_ASSETS.mascot.height}
                priority
                sizes="(min-width: 1024px) 470px, 85vw"
                className="relative h-auto w-full drop-shadow-[0_24px_40px_rgba(23,105,245,0.25)]"
              />
            </div>
          </div>
        </section>

        {/* Tasks + readiness and controls */}
        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-ink">
              <span className="h-7 w-1.5 rounded-full bg-primary" aria-hidden /> Practise 9 TOEFL Tasks in 4 VR Zones
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {ZONES.map((z) => (
                <li key={z.id} className={cn("flex h-full flex-col rounded-3xl border border-line bg-gradient-to-br p-5 shadow-card", z.tone)}>
                  <Image src={z.icon.src} alt="" width={z.icon.width} height={z.icon.height} className="mx-auto h-24 w-auto object-contain" />
                  <h3 className="mt-3 text-lg font-extrabold text-ink">{z.title}</h3>
                  <ul className="mt-2 space-y-1.5 text-[14px] leading-snug text-body">
                    {z.tasks.map((t) => (
                      <li key={t} className="flex gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Write an Email and Write for an Academic Discussion are typing tasks, so they stay on the website. All 12 tasks are always available there.</p>
          </div>

          <aside aria-label="VR readiness and controls" className="rounded-3xl border border-line bg-surface/90 p-4 shadow-card backdrop-blur lg:-mt-6">
            <VrReadiness />
            <div className="mt-4 rounded-2xl border border-line bg-surface-soft p-4">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
                <Image src={VR_ASSETS.pinchSelect.src} alt="" width={34} height={26} className="h-6 w-auto" /> How to Use in VR
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-3">
                <HandTile image={VR_ASSETS.pinchSelect} label="Pinch to Select" hint="Touch your thumb and index finger to press a button or pick an answer." />
                <HandTile image={VR_ASSETS.pinchHold} label="Pinch & Hold to Grab" hint="Pinch a word tile, move your hand, and let go over a slot." />
              </ul>
              <p className="mt-3 text-xs text-muted">No controllers needed. Sit down, and use Recenter in the room if the desk looks too high or low.</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

/** Logo goes back to the main site (dashboard when signed in); the name chip opens a Log out menu. */
function VrHeader({ firstName, guest }: { firstName: string | null; guest: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <span className="flex items-center gap-2">
          <Logo size={34} href={guest ? "/api/auth/guest/exit?next=/" : firstName ? "/dashboard" : "/"} />
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-extrabold text-on-primary">VR</span>
        </span>
        <div className="ml-auto">{firstName && <VrAccountMenu firstName={firstName} />}</div>
      </div>
    </header>
  );
}

interface CtaProps {
  href: string;
  label: string;
  external: boolean;
  variant: "primary" | "secondary";
  icon: { src: string; width: number; height: number } | null;
}

/** Main buttons. The 3D room is a static page outside the Next.js routes, so it uses a plain link. */
function ctaClass(variant: "primary" | "secondary") {
  return cn(
    "inline-flex h-14 items-center gap-3 rounded-2xl px-6 text-lg font-bold transition",
    variant === "primary" ? "bg-primary text-on-primary shadow-lg shadow-primary/25 hover:bg-primary-hover" : "border-2 border-primary/30 bg-surface text-ink hover:border-primary hover:text-primary",
  );
}

function CtaLink({ href, label, external, variant, icon }: CtaProps) {
  const className = ctaClass(variant);
  const content = (
    <>
      {icon && <Image src={icon.src} alt="" width={icon.width} height={icon.height} className={cn("h-6 w-auto", variant === "primary" && "brightness-0 invert")} />}
      {label}
      {variant === "primary" && <span aria-hidden>→</span>}
    </>
  );
  return external ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function HandTile({ image, label, hint }: { image: { src: string; width: number; height: number }; label: string; hint: string }) {
  return (
    <li className="flex flex-col items-center rounded-2xl border border-line bg-surface p-3 text-center" title={hint}>
      <Image src={image.src} alt="" width={image.width} height={image.height} className="h-20 w-auto object-contain" />
      <p className="mt-2 text-sm font-bold text-ink">{label}</p>
      <p className="mt-1 text-xs leading-snug text-muted">{hint}</p>
    </li>
  );
}
