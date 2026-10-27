import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Icon3D } from "./Icon3D";
import { cn } from "@/lib/utils/cn";

export function TipCard({ title = "Tip", children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <aside className={cn("rounded-[var(--radius-card)] border border-tip-line bg-tip p-5", className)} aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        <Icon3D name="tips" size={26} />
        <h2 className="text-base font-bold text-ink">{title}</h2>
      </div>
      <div className="space-y-1.5 text-sm leading-relaxed text-body">{children}</div>
    </aside>
  );
}

export function InfoCallout({ title, children, className, icon }: { title?: string; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn("flex gap-3 rounded-xl bg-primary-soft/70 p-4 text-sm text-body", className)}>
      <span className="mt-0.5 text-primary">{icon ?? <Info className="size-5" aria-hidden />}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="mb-1 font-bold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function BulletList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn("list-disc space-y-1 pl-5", className)}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
