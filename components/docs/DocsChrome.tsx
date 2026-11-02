"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ExternalLink, Menu, Search, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Icon3D } from "@/components/ui/Icon3D";
import { LinkButton } from "@/components/ui/Button";
import { gsap, prefersReducedMotion } from "@/lib/client/motion";
import type { Icon3DName } from "@/lib/config/assets";
import { SITE } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";
import { DocsSearch, type SearchSection } from "./DocsSearch";
import { OPEN_DOCS_SEARCH } from "./DocsSearchButton";

export type { SearchSection };

export interface DocsNavItem {
  slug: string;
  nav: string;
  icon: Icon3DName;
  headings: { id: string; text: string }[];
}

export interface DocsNavGroup {
  group: string;
  items: DocsNavItem[];
}

/** Header, sidebar (a drawer on small screens) and search around every /docs page. */
export function DocsChrome({ groups, index, children }: { groups: DocsNavGroup[]; index: SearchSection[]; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  // ⌘K / Ctrl+K or "/" opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    const onOpen = () => setSearchOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_DOCS_SEARCH, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_DOCS_SEARCH, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen || !drawer.current || prefersReducedMotion()) return;
    const tween = gsap.fromTo(drawer.current, { xPercent: -100 }, { xPercent: 0, duration: 0.35, ease: "power3.out" });
    return () => {
      tween.kill();
    };
  }, [menuOpen]);

  return (
    <div className="docs-root min-h-dvh bg-page">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open the docs menu"
            className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-muted lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Logo size={34} priority />
          <Link href="/docs" className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary hover:bg-primary/15">
            Docs
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-line bg-surface-soft text-muted transition-colors hover:border-primary hover:text-ink sm:w-64 sm:justify-start sm:px-4 md:w-80"
            aria-label="Search the docs"
          >
            <Search className="size-4 shrink-0" />
            <span className="hidden flex-1 text-left text-sm sm:inline">Search the docs…</span>
            <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-muted sm:inline">⌘K</kbd>
          </button>
          <a
            href={SITE.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:text-primary md:inline-flex"
          >
            GitHub <ExternalLink className="size-3.5" />
          </a>
          <span className="hidden sm:block">
            <LinkButton href="/dashboard" size="sm" rightIcon={<ArrowRight className="size-4" />}>
              Open the app
            </LinkButton>
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-72 shrink-0 overflow-y-auto border-r border-line px-4 py-6 lg:block">
          <DocsNav groups={groups} pathname={pathname} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Docs menu">
          <button type="button" className="absolute inset-0 bg-brand-950/40 backdrop-blur-sm" aria-label="Close the docs menu" onClick={() => setMenuOpen(false)} />
          <div ref={drawer} className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-surface shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo size={30} />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close the docs menu" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <DocsNav groups={groups} pathname={pathname} />
              <LinkButton href="/dashboard" fullWidth className="mt-6" rightIcon={<ArrowRight className="size-4" />}>
                Open the app
              </LinkButton>
            </div>
          </div>
        </div>
      )}

      <DocsSearch open={searchOpen} onClose={() => setSearchOpen(false)} index={index} />

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>
            {SITE.name} docs · open source under the MIT License. TOEFL is a registered trademark of ETS; this project is not affiliated with ETS.
          </p>
          <nav aria-label="Footer" className="flex gap-5 font-semibold text-ink">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <Link href="/docs" className="hover:text-primary">
              Docs
            </Link>
            <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DocsNav({ groups, pathname }: { groups: DocsNavGroup[]; pathname: string }) {
  return (
    <nav aria-label="Docs" className="space-y-6">
      <Link
        href="/docs"
        aria-current={pathname === "/docs" ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold",
          pathname === "/docs" ? "bg-primary-soft text-primary" : "text-ink hover:bg-surface-muted",
        )}
      >
        <Icon3D name="home" size={22} /> Overview
      </Link>
      {groups.map((g) => (
        <div key={g.group}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{g.group}</p>
          <ul className="mt-2 space-y-1">
            {g.items.map((item) => {
              const active = pathname === `/docs/${item.slug}`;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold transition-colors",
                      active ? "bg-primary-soft text-primary" : "text-ink hover:bg-surface-muted",
                    )}
                  >
                    <Icon3D name={item.icon} size={22} /> {item.nav}
                  </Link>
                  {active && item.headings.length > 0 && (
                    <ul className="mb-2 ml-[22px] mt-1 space-y-0.5 border-l border-line pl-3">
                      {item.headings.map((h) => (
                        <li key={h.id}>
                          <a href={`#${h.id}`} className="block rounded-md px-2 py-1 text-[13.5px] leading-snug text-muted hover:bg-surface-muted hover:text-ink">
                            {h.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
