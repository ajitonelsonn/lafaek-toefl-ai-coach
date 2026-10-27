import Image from "next/image";
import { icon3dSrc, type Icon3DName } from "@/lib/config/assets";
import { cn } from "@/lib/utils/cn";

/** A 3D icon cropped from the supplied icon sheet. Decorative unless `alt` is given. */
export function Icon3D({ name, size = 32, alt = "", className }: { name: Icon3DName; size?: number; alt?: string; className?: string }) {
  return <Image src={icon3dSrc(name)} alt={alt} width={size} height={size} className={cn("shrink-0 object-contain", className)} />;
}

export function IconTile({ name, size = 56, tone = "primary", className }: {
  name: Icon3DName;
  size?: number;
  tone?: "primary" | "reading" | "listening" | "writing" | "speaking" | "warning" | "success";
  className?: string;
}) {
  const bg = {
    primary: "bg-primary-soft",
    reading: "bg-reading-soft",
    listening: "bg-listening-soft",
    writing: "bg-writing-soft",
    speaking: "bg-speaking-soft",
    warning: "bg-warning-soft",
    success: "bg-success-soft",
  }[tone];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl", bg, className)} style={{ width: size, height: size }} aria-hidden>
      <Icon3D name={name} size={Math.round(size * 0.6)} />
    </span>
  );
}
