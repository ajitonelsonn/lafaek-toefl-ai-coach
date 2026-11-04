"use client";

import Image from "next/image";
import { useRef } from "react";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/lib/config/assets";
import { gsap, ScrollTrigger, useMotion } from "@/lib/client/motion";
import { cn } from "@/lib/utils/cn";

const META_LOGO = "/assets/brands/meta.svg";

/** The four Meta models the app calls through the Meta Model API (see lib/server/env.ts). */
const MODELS: { id: string; name: string; role: string; body: string; stat: string; icon: Icon3DName; tone: string }[] = [
  {
    id: "muse-spark-1.3",
    name: "Muse Spark 1.3",
    role: "Main text model",
    body: "Writes every practice question in the 2026 formats, picks your vocabulary, plans your study days, and scores your writing and speaking from 1 to 6.",
    stat: "133 questions per plan",
    icon: "ai-coach",
    tone: "bg-primary-soft",
  },
  {
    id: "muse-spark-1.2",
    name: "Muse Spark 1.2",
    role: "Fallback",
    body: "Takes over automatically if Muse Spark 1.3 is not available, so your study plan is still made.",
    stat: "Automatic backup",
    icon: "retry",
    tone: "bg-surface-muted",
  },
  {
    id: "muse-image-1.0",
    name: "Muse Image 1.0",
    role: "Pictures",
    body: "Draws the scene for listening and speaking questions, showing the same people you hear in the audio.",
    stat: "25 pictures per plan",
    icon: "image",
    tone: "bg-listening-soft",
  },
  {
    id: "muse-voice-transcribe-1.0",
    name: "Muse Voice Transcribe",
    role: "Speech-to-text",
    body: "Turns your spoken answers into text, so Listen and Repeat and the interview can be checked and scored.",
    stat: "Speaking scored by AI",
    icon: "voice",
    tone: "bg-speaking-soft",
  },
];

/** Landing page: the Meta models behind the app, shown below the pricing. */
export function MetaModelsSection() {
  const root = useRef<HTMLElement>(null);

  useMotion(root, (el) => {
    const cards = gsap.utils.toArray<HTMLElement>("[data-model-card]");
    gsap.set("[data-model-head] > *", { y: 24, autoAlpha: 0 });
    gsap.set(cards, { y: 50, autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      once: true,
      onEnter: () => {
        gsap
          .timeline()
          .to("[data-model-head] > *", { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.1, ease: "power3.out" })
          .to(cards, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.12, ease: "back.out(1.4)" }, 0.2)
          .from("[data-model-logo]", { scale: 0, rotation: -90, duration: 0.6, stagger: 0.12, ease: "back.out(2)" }, 0.4)
          .from("[data-model-icon]", { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.12, ease: "power2.out" }, 0.55)
          .add(() => {
            // The Meta logo in the heading keeps a slow, soft pulse.
            gsap.to("[data-model-pulse]", { scale: 1.08, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
          });
      },
    });
  });

  return (
    <section ref={root} id="models" aria-labelledby="models-title" className="scroll-mt-24 bg-surface">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <div data-model-head className="text-center">
          <p className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
            <Image data-model-pulse src={META_LOGO} alt="" width={22} height={22} className="size-5" /> Powered by Meta
            <span className="h-0.5 w-12 rounded bg-primary" aria-hidden />
          </p>
          <h2 id="models-title" className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Four Meta models do the work
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-body">
            Every question, picture and AI score you see comes from these models, through the Meta Model API.
          </p>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODELS.map((m) => (
            <li key={m.id} data-model-card className="flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-card transition-shadow duration-300 hover:shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-soft py-1 pl-1.5 pr-3 text-xs font-bold uppercase tracking-[0.12em] text-ink">
                  <span data-model-logo className="inline-flex size-6 items-center justify-center rounded-full bg-surface">
                    <Image src={META_LOGO} alt="Meta" width={18} height={18} className="size-[18px]" />
                  </span>
                  Meta
                </span>
                <span data-model-icon className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl", m.tone)}>
                  <Icon3D name={m.icon} size={30} />
                </span>
              </div>
              <h3 className="mt-5 text-xl font-extrabold text-ink">{m.name}</h3>
              <p className="mt-0.5 text-sm font-semibold text-primary">{m.role}</p>
              <code className="mt-3 block w-fit max-w-full truncate rounded-lg bg-surface-muted px-2.5 py-1 font-mono text-[13px] text-ink">{m.id}</code>
              <p className="mt-4 flex-1 text-[15px] leading-relaxed text-body">{m.body}</p>
              <p className="mt-5 border-t border-line pt-4 text-sm font-semibold text-ink">{m.stat}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
