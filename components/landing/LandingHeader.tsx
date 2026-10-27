"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, LayoutDashboard, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LinkButton } from "@/components/ui/Button";

const LINKS = [
  { href: "#practice", label: "Practice" },
  { href: "#study-plan", label: "Study Plan" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
];

/** `user` is set when a session exists: show the way back into the app instead of sign-in links. */
export function LandingHeader({ user }: { user?: { name: string } | null }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo size={46} priority />
        <nav aria-label="Main" className="ml-8 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-4 py-2 text-[15px] font-semibold text-ink hover:bg-primary-soft hover:text-primary">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-48 truncate px-3 text-[15px] font-semibold text-ink lg:inline-block">Hi, {user.name}</span>
              <span className="hidden sm:block">
                <LinkButton href="/dashboard" leftIcon={<LayoutDashboard className="size-4" />}>
                  Go to Dashboard
                </LinkButton>
              </span>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-[15px] font-semibold text-ink hover:text-primary sm:inline-block">
                Sign in
              </Link>
              <span className="hidden sm:block">
                <LinkButton href="/signup" rightIcon={<ArrowRight className="size-4" />}>
                  Get Started
                </LinkButton>
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted md:hidden"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="landing-menu" aria-label="Mobile" className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-semibold text-ink hover:bg-surface-muted">
                  {l.label}
                </a>
              </li>
            ))}
            {user ? (
              <li className="pt-2">
                <LinkButton href="/dashboard" fullWidth leftIcon={<LayoutDashboard className="size-4" />}>
                  Go to Dashboard
                </LinkButton>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/login" className="block rounded-lg px-3 py-2.5 font-semibold text-ink hover:bg-surface-muted">
                    Sign in
                  </Link>
                </li>
                <li className="pt-2">
                  <LinkButton href="/signup" fullWidth>
                    Get Started
                  </LinkButton>
                </li>
              </>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
