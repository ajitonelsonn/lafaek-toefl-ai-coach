import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VR_ASSETS } from "@/lib/config/assets";

/**
 * The hero's way into the VR Study Room: a wide card under the main buttons, with a gradient
 * border, the mascot in a headset, a short line and an arrow. A light sweeps across it.
 */
export function VrHeroButton() {
  return (
    <Link
      href="/vr"
      className="group relative block w-0 min-w-full rounded-2xl bg-gradient-to-r from-[#101b4d] via-primary to-cyan-400 p-[2px] shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
    >
      <span className="relative flex items-center gap-4 overflow-hidden rounded-[14px] bg-surface px-4 py-3">
        <span
          className="vr-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
          aria-hidden
        />
        <span className="relative flex size-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-primary-soft">
          <Image
            src={VR_ASSETS.mascot.src}
            alt=""
            width={VR_ASSETS.mascot.width}
            height={VR_ASSETS.mascot.height}
            sizes="64px"
            className="h-14 w-auto"
          />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <Image
              src={VR_ASSETS.vr.src}
              alt=""
              width={VR_ASSETS.vr.width}
              height={VR_ASSETS.vr.height}
              className="h-4 w-auto"
            />
            Try it in VR
          </span>
          <span className="block text-[15px] leading-snug text-body">
            On Meta Quest with your hands, or preview it in your browser.
          </span>
        </span>
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#101b4d] to-primary text-white transition group-hover:translate-x-0.5">
          <ArrowRight className="size-5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
