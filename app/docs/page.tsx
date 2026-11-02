import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, ExternalLink } from "lucide-react";
import { DocsMotion } from "@/components/docs/DocsMotion";
import { DocsSearchButton } from "@/components/docs/DocsSearchButton";
import { Icon3D, IconTile } from "@/components/ui/Icon3D";
import { LinkButton } from "@/components/ui/Button";
import { BRAND, type Icon3DName } from "@/lib/config/assets";
import { DOCS, docHref } from "@/lib/config/docs";
import { SITE } from "@/lib/config/site";
import { getDoc, mediaUrl } from "@/lib/server/docs";

export const metadata: Metadata = { title: { absolute: `Docs · ${SITE.name}` } };

const ORBIT: { icon: Icon3DName; className: string }[] = [
  { icon: "document", className: "left-[2%] top-[10%]" },
  { icon: "ai-coach", className: "right-[4%] top-[4%]" },
  { icon: "listening", className: "left-[-2%] bottom-[22%]" },
  { icon: "analytics", className: "right-[0%] bottom-[28%]" },
  { icon: "mock-test", className: "left-[38%] bottom-[-2%]" },
];

const STATS = [
  { value: String(DOCS.length), label: "guides" },
  { value: "12", label: "TOEFL 2026 task types" },
  { value: "5", label: "AI models" },
  { value: "MIT", label: "open source" },
];

const MODELS = [
  { name: "muse-spark-1.3", by: "Meta", role: "Questions, vocabulary, study schedules, AI scores and coaching" },
  { name: "muse-spark-1.2", by: "Meta", role: "Automatic fallback for text" },
  { name: "muse-image-1.0", by: "Meta", role: "Pictures for practice questions" },
  { name: "muse-voice-transcribe-1.0", by: "Meta", role: "Speech-to-text for spoken answers" },
  { name: "eleven_multilingual_v2", by: "ElevenLabs", role: "Voices in five English accents" },
];

const shot = (name: string) => mediaUrl(`docs/user-guide/images/${name}.webp`);

export default function DocsHome() {
  return (
    <div className="overflow-hidden">
      <DocsMotion home />

      {/* Hero */}
      <section className="relative border-b border-line bg-gradient-to-b from-brand-50 to-page dark:from-surface">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,#000,transparent_85%)]"
          aria-hidden
        />
        <div className="relative grid items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:px-12 lg:py-16">
          <div data-docs-in>
            <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-muted">
              Documentation <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl xl:text-[3.6rem]">
              Everything about <span className="bg-gradient-to-r from-brand-600 to-[#7444d6] bg-clip-text text-transparent">LafaekTOEFL AI Coach</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-body">
              Why it exists, how to use it, and how it is built: a free, open-source AI coach for the new 2026 TOEFL, powered by Meta&apos;s Muse models.
            </p>
            <div className="mt-7">
              <DocsSearchButton />
            </div>
            <dl className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-2xl border border-line bg-surface/80 px-4 py-3">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block text-2xl font-extrabold text-primary">{s.value}</span>
                    <span className="block text-xs font-semibold leading-tight text-muted">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div data-docs-art className="relative mx-auto w-full max-w-[460px]">
            <div className="absolute inset-[10%] rounded-full bg-primary/15 blur-3xl" aria-hidden />
            <Image src={BRAND.mark.src} alt="The LafaekTOEFL crocodile mascot" width={BRAND.mark.width} height={BRAND.mark.height} priority className="relative h-auto w-full" data-float sizes="460px" />
            {ORBIT.map((o) => (
              <span key={o.icon} data-orbit className={`absolute ${o.className} inline-flex size-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-lg sm:size-[72px]`} aria-hidden>
                <Icon3D name={o.icon} size={40} />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Reading path */}
      <section data-journey className="px-4 py-14 sm:px-8 lg:px-12">
        <div data-reveal className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Read in this order</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">From the story to the code</h2>
          <p className="mt-3 text-body">Start with why the app exists, see it in action, then go as deep into the technology as you like.</p>
        </div>
        <div className="relative mt-10">
          <svg className="pointer-events-none absolute left-0 right-0 top-[30px] hidden h-2 w-full 2xl:block" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden>
            <path data-journey-line d="M 40 4 H 960" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.45" />
          </svg>
          <ol className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {DOCS.map((d, i) => (
              <li key={d.slug} data-reveal>
                <Link
                  href={docHref(d.slug)}
                  className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1.5 hover:border-primary hover:shadow-[0_18px_40px_rgba(23,105,245,0.14)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-[60px] items-center justify-center rounded-full border-4 border-page bg-primary text-xl font-extrabold text-on-primary shadow-md">{i + 1}</span>
                    <IconTile name={d.icon} size={52} />
                  </div>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{d.group}</p>
                  <h3 className="mt-1 text-xl font-bold text-ink group-hover:text-primary">{d.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-body">{d.description}</p>
                  <div className="mt-5 flex items-center justify-between text-sm font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Clock className="size-3.5" /> {getDoc(d.slug)?.readingMinutes ?? 1} min read
                    </span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* See the app */}
      <section className="border-y border-line bg-surface px-4 py-14 sm:px-8 lg:px-12">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div data-reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">User guide</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">See every screen before you sign up</h2>
            <p className="mt-3 text-body">
              The user guide walks through the real app with screenshots: the AI study plan, all 12 practice types, vocabulary from your own questions, progress, the timed mock test and verifiable certificates.
            </p>
            <LinkButton href={docHref("user-guide")} className="mt-6" rightIcon={<ArrowRight className="size-4" />}>
              Open the user guide
            </LinkButton>
          </div>
          <div className="relative grid grid-cols-6 gap-4" data-reveal>
            {/* eslint-disable @next/next/no-img-element -- images are optimised by /docs/media */}
            <Link href={`${docHref("user-guide")}#3-your-dashboard`} className="col-span-6 overflow-hidden rounded-2xl border border-line shadow-xl transition hover:-translate-y-1" data-parallax="16">
              <img src={shot("dashboard")} alt="The dashboard" loading="lazy" className="w-full" />
            </Link>
            <Link href={`${docHref("user-guide")}#listening`} className="col-span-3 overflow-hidden rounded-2xl border border-line shadow-lg transition hover:-translate-y-1" data-parallax="28">
              <img src={shot("listen-conversation")} alt="A listening task" loading="lazy" className="w-full" />
            </Link>
            <Link href={`${docHref("user-guide")}#10-earn-a-certificate`} className="col-span-3 overflow-hidden rounded-2xl border border-line shadow-lg transition hover:-translate-y-1" data-parallax="40">
              <img src={shot("certificate-preview")} alt="The certificate" loading="lazy" className="w-full" />
            </Link>
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        </div>
      </section>

      {/* Models and architecture */}
      <section className="px-4 py-14 sm:px-8 lg:px-12">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <div data-reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How it works</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Built with Meta&apos;s newest models</h2>
              <p className="mt-3 text-body">
                A Next.js web app on Vercel, a background worker and PostgreSQL on Render, and private media in AWS S3. The worker and the web app share work through a job queue in the database.
              </p>
            </div>
            <ul className="mt-6 space-y-3">
              {MODELS.map((m) => (
                <li key={m.name} data-chip className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3">
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${m.by === "Meta" ? "bg-primary-soft text-primary" : "bg-surface-muted text-ink"}`}>{m.by}</span>
                  <span className="min-w-0">
                    <code className="block truncate font-mono text-[15px] font-bold text-ink">{m.name}</code>
                    <span className="block text-sm text-muted">{m.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Link href={docHref("how-it-works")} data-reveal className="group block overflow-hidden rounded-3xl border border-line bg-surface p-3 shadow-xl transition hover:-translate-y-1 hover:border-primary">
            {/* eslint-disable-next-line @next/next/no-img-element -- optimised by /docs/media */}
            <img src={mediaUrl("docs/diagram/01-architecture.png")} alt="System architecture diagram" loading="lazy" className="w-full rounded-2xl" />
            <span className="flex items-center justify-between px-3 pb-1 pt-4 font-semibold">
              <span className="text-ink group-hover:text-primary">System architecture and 4 more diagrams</span>
              <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      {/* Call to action */}
      <section className="px-4 pb-16 sm:px-8 lg:px-12">
        <div data-reveal className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-700 via-brand-600 to-[#5b3fd6] px-6 py-10 text-white sm:px-12">
          <div className="absolute -right-10 -top-16 size-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Ready to prepare for the new TOEFL?</h2>
              <p className="mt-2 max-w-xl text-white/85">Start free with a personal AI study plan and a full mock test, or deploy your own copy from GitHub.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-white px-6 font-semibold text-brand-700 shadow-sm hover:bg-brand-50">
                Start free <ArrowRight className="size-4" />
              </Link>
              <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] border border-white/40 px-6 font-semibold text-white hover:bg-white/10">
                Deploy your own <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
