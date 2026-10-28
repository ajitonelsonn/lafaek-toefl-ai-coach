import Image from "next/image";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Icon3D } from "@/components/ui/Icon3D";
import type { AssetImage } from "@/lib/config/assets";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  scene: AssetImage;
  sceneAlt: string;
  children: ReactNode;
}

const FEATURES = [
  { icon: "goal", label: "12 Practice Types" },
  { icon: "analytics", label: "Track Progress" },
  { icon: "tips", label: "AI Coaching" },
] as const;

export function AuthLayout({ title, subtitle, scene, sceneAlt, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative flex flex-col items-center overflow-hidden bg-gradient-to-b from-[#eef4ff] via-[#f4f7ff] to-[#fdf3ea] px-6 pb-6 pt-8 text-center lg:pb-10 lg:pt-14">
        <Logo size={64} priority />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl lg:mt-10">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-slate-600 sm:text-lg">{subtitle}</p>
        <Image src={scene.src} alt={sceneAlt} width={scene.width} height={scene.height} priority sizes="520px" className="mt-8 hidden h-auto w-full max-w-[520px] rounded-2xl lg:block" />
        <ul className="mt-8 hidden w-full max-w-lg grid-cols-3 gap-4 lg:grid">
          {FEATURES.map((f) => (
            <li key={f.label} className="flex flex-col items-center gap-2 text-sm font-semibold text-brand-950">
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-white shadow-sm">
                <Icon3D name={f.icon} size={30} />
              </span>
              {f.label}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex items-start justify-center bg-page px-4 py-8 sm:px-6 lg:items-center lg:py-12">
        <div className="w-full max-w-[520px] rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-10">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, subtitle, icon }: { title: string; subtitle: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-7 text-center">
      {icon && <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-primary-soft">{icon}</div>}
      <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">{title}</h2>
      <p className="mt-2 text-body">{subtitle}</p>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-sm text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
