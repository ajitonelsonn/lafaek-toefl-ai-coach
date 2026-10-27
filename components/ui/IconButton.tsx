import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  variant?: "plain" | "outline" | "soft";
  size?: "sm" | "md";
}

export function IconButton({ label, children, variant = "plain", size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "size-8" : "size-10",
        variant === "plain" && "text-muted hover:bg-surface-muted hover:text-ink",
        variant === "outline" && "border border-line bg-surface text-primary hover:border-primary",
        variant === "soft" && "bg-primary-soft text-primary hover:bg-primary/15",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
