import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/config/assets";
import { SITE } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

interface LogoProps {
  variant?: "horizontal" | "stacked" | "mark";
  href?: string | null;
  className?: string;
  priority?: boolean;
  /** Height of the mascot mark in the horizontal lockup, in px. */
  size?: number;
}

/**
 * Brand lockup built only from the supplied logo.png: the mascot mark and the
 * wordmark are exact crops of that file (see public/assets/ASSET_MANIFEST.md).
 */
export function Logo({ variant = "horizontal", href = "/", className, priority, size = 48 }: LogoProps) {
  let content: React.ReactNode;
  if (variant === "stacked") {
    content = (
      <Image src={BRAND.logoTrimmed.src} alt={SITE.name} width={BRAND.logoTrimmed.width} height={BRAND.logoTrimmed.height} priority={priority} className="h-auto w-full" sizes="240px" />
    );
  } else if (variant === "mark") {
    content = <Image src={BRAND.mark.src} alt={SITE.name} width={size * 1.27} height={size} priority={priority} style={{ width: size * 1.27, height: size }} />;
  } else {
    const wordHeight = Math.round(size * 0.62);
    content = (
      <span className="flex items-center gap-2">
        <Image src={BRAND.mark.src} alt="" width={Math.round(size * 1.27)} height={size} priority={priority} style={{ width: Math.round(size * 1.27), height: size }} />
        <Image
          src={BRAND.wordmark.src}
          alt={SITE.name}
          width={Math.round(wordHeight * 4.96)}
          height={wordHeight}
          priority={priority}
          style={{ width: Math.round(wordHeight * 4.96), height: wordHeight }}
        />
      </span>
    );
  }

  const wrapper = cn("inline-flex shrink-0 items-center dark:rounded-xl dark:bg-white/95 dark:px-2 dark:py-1", className);
  if (!href) return <span className={wrapper}>{content}</span>;
  return (
    <Link href={href} className={wrapper} aria-label={`${SITE.name} home`}>
      {content}
    </Link>
  );
}
