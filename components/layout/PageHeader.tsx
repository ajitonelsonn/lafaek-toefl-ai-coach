import Image from "next/image";
import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/Icon3D";
import type { AssetImage, Icon3DName } from "@/lib/config/assets";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: Icon3DName;
  iconTone?: "primary" | "reading" | "listening" | "writing" | "speaking";
  art?: AssetImage;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, iconTone = "primary", art, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-center gap-4 sm:mb-8", className)}>
      {icon && (
        <span className="hidden sm:block">
          <IconTile name={icon} size={64} tone={iconTone} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 text-base text-muted sm:text-lg">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      {art && (
        <Image
          src={art.src}
          alt=""
          width={art.width}
          height={art.height}
          className="art-fade hidden h-24 w-auto shrink-0 object-contain md:block dark:opacity-80"
          priority
        />
      )}
    </header>
  );
}

export function SectionHeading({ title, description, action, as: H = "h2", className, id }: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <H id={id} className="text-xl font-bold text-ink">
          {title}
        </H>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
