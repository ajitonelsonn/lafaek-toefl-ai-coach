import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Code2, Compass, LockOpen, Sparkles } from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Logo } from "@/components/brand/Logo";
import { LinkButton } from "@/components/ui/Button";
import { Icon3D } from "@/components/ui/Icon3D";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SKILL_ICON_3D, SKILL_TONE } from "@/components/practice/icons";
import { BRAND } from "@/lib/config/assets";
import { PRACTICE_TYPES, SKILLS, practiceHref, practiceTypesForSkill } from "@/lib/config/practice-types";
import { SITE } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

const FEATURES = [
  {
    icon: "calendar",
    title: "Personal study plan",
    body: "Tell us your level, goal and study time. Get a week-by-week plan and daily tasks.",
    status: "Available",
  },
  {
    icon: "analytics",
    title: "Progress tracking",
    body: "See which practice types you have finished, your accuracy, and what to do next.",
    status: "Available",
  },
  {
    icon: "feedback",
    title: "AI-powered feedback",
    body: "Detailed explanations, sample answers and personal feedback on writing and speaking.",
    status: "Coming soon",
  },
  {
    icon: "ai-practice",
    title: "AI-generated practice",
    body: "Fresh questions made for your study plan, released step by step as they are ready.",
    status: "Coming soon",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <LandingHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-surface dark:from-page">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-16">
            <div>
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Open-source TOEFL preparation <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
              </p>
              <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                Your TOEFL Journey <span className="block text-primary">Starts Here.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-body sm:text-xl">
                Practise all four skills with the 12 TOEFL task types. Build confidence, track your progress, and prepare at your own pace.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/signup" size="lg" className="h-14 px-7 text-lg" rightIcon={<ArrowRight className="size-5" />}>
                  Start Practising
                </LinkButton>
                <LinkButton href="/practice" size="lg" variant="secondary" className="h-14 px-7 text-lg" leftIcon={<Compass className="size-5 text-primary" />}>
                  Explore Practice
                </LinkButton>
              </div>
              <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] text-body">
                <li className="flex items-center gap-2">
                  <LockOpen className="size-5 text-success" aria-hidden /> Free
                </li>
                <li className="flex items-center gap-2">
                  <Code2 className="size-5 text-primary" aria-hidden /> Open source
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" aria-hidden /> AI coaching in development
                </li>
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute inset-[8%] rounded-full bg-primary/10 blur-2xl" aria-hidden />
              <Image src={BRAND.mark.src} alt="The LafaekTOEFL crocodile mascot in a graduation cap, holding a book and giving a thumbs-up" width={BRAND.mark.width} height={BRAND.mark.height} priority sizes="(min-width: 1024px) 560px, 90vw" className="relative h-auto w-full" />
              <p className="absolute -right-1 top-2 hidden rotate-[-8deg] text-right text-xl font-semibold italic leading-tight text-primary sm:block">
                Practise.
                <br />
                Learn.
                <br />
                Improve.
                <br />
                Succeed!
              </p>
            </div>
          </div>
        </section>

        {/* Skills */}
        <section id="practice" aria-labelledby="skills-title" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            12 practice types, 4 skills <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
          </p>
          <h2 id="skills-title" className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Practise every part of the TOEFL
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {SKILLS.map((skill) => {
              const tone = SKILL_TONE[skill.id];
              return (
                <article key={skill.id} className={cn("flex flex-col rounded-2xl border p-5", tone.soft, tone.border)}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-surface shadow-sm">
                      <Icon3D name={SKILL_ICON_3D[skill.id]} size={34} />
                    </span>
                    <h3 className="text-xl font-bold text-ink">{skill.title}</h3>
                  </div>
                  <p className="mt-3 text-[15px] text-body">{skill.description}</p>
                  <ul className="mt-4 space-y-1.5">
                    {practiceTypesForSkill(skill.id).map((t) => (
                      <li key={t.slug}>
                        <Link href={practiceHref(t.slug)} className={cn("inline-flex items-center gap-1.5 text-sm font-semibold hover:underline", tone.text)}>
                          <ArrowRight className="size-3.5" aria-hidden /> {t.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-muted">
            Exactly {PRACTICE_TYPES.length} task types, matching the TOEFL 2026 format. Speaking has two: Listen and Repeat, and Take an Interview.
          </p>
        </section>

        {/* Features */}
        <section id="study-plan" aria-labelledby="features-title" className="scroll-mt-24 bg-surface-soft">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Why LafaekTOEFL AI Coach <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
            </p>
            <h2 id="features-title" className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Everything you need to practise smarter
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {FEATURES.map((f) => (
                <article key={f.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft">
                      <Icon3D name={f.icon} size={32} />
                    </span>
                    <StatusBadge tone={f.status === "Available" ? "success" : "warning"}>{f.status}</StatusBadge>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-[15px] text-body">{f.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" rightIcon={<ArrowRight className="size-4" />}>
                Get Started
              </LinkButton>
              <LinkButton href="/study-plan" variant="secondary">
                Preview the study plan
              </LinkButton>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" aria-labelledby="about-title" className="scroll-mt-24 mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[auto_1fr]">
          <Image src={BRAND.logoTrimmed.src} alt="" width={240} height={203} className="mx-auto h-auto w-48 md:w-60" />
          <div>
            <h2 id="about-title" className="text-3xl font-extrabold tracking-tight text-ink">
              About {SITE.shortName}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-body sm:text-base">
              “Lafaek” means crocodile. Our friendly crocodile coach helps learners at every English level prepare for the TOEFL with clear
              instructions and encouraging feedback. {SITE.shortName} is free and open source.
            </p>
            <p className="mt-3 max-w-2xl rounded-xl bg-warning-soft p-3 text-sm text-body">
              <span className="font-semibold text-ink">Preview version:</span> this site currently uses hand-written sample questions and simulated
              sign-in. AI-generated questions and AI feedback are not connected yet. Scores are practice estimates, not official TOEFL scores.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
          <Logo size={32} />
          <p className="text-center text-sm text-muted">An open-source TOEFL preparation platform. TOEFL is a registered trademark of ETS; this site is not affiliated with ETS.</p>
          <nav aria-label="Footer" className="flex gap-5 text-sm font-semibold text-ink">
            <a href="#about" className="hover:text-primary">
              About
            </a>
            <Link href="/practice" className="hover:text-primary">
              Practice
            </Link>
            <Link href="/login" className="hover:text-primary">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
