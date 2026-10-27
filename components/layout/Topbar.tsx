"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, Search, Settings, UserRound } from "lucide-react";
import { PAGE_TITLES, PRIMARY_NAV, ACCOUNT_NAV } from "@/lib/config/navigation";
import { PRACTICE_TYPES, getPracticeType, getSkill } from "@/lib/config/practice-types";
import { useSession } from "@/components/session/SessionProvider";
import { api, errorMessage } from "@/lib/client/api";
import type { GenerationBatchDTO } from "@/lib/practice/generation-dto";
import { useDismiss } from "@/lib/hooks/useDismiss";
import { initials } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";

interface Crumb {
  label: string;
  href?: string;
}

function useCrumbs(): Crumb[] {
  const pathname = usePathname();
  const [first, second, third] = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }];
  if (!first || first === "dashboard") return [{ label: "Dashboard" }];
  if (first === "practice" && second) {
    const type = getPracticeType(second);
    crumbs.splice(0, 1, { label: "Practice", href: "/practice" });
    if (type) {
      crumbs.push({ label: getSkill(type.skill).title, href: `/practice?skill=${type.skill}` });
      crumbs.push({ label: type.title });
    }
    return crumbs;
  }
  if (first === "mock-test" && second) {
    crumbs.push({ label: "Mock Test", href: "/mock-test" });
    crumbs.push({ label: second === "session" ? "Session" : "Results" });
    return crumbs;
  }
  crumbs.push({ label: PAGE_TITLES[first] ?? first });
  void third;
  return crumbs;
}

function Breadcrumbs() {
  const crumbs = useCrumbs();
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />}
            {c.href ? (
              <Link href={c.href} className="truncate text-muted hover:text-primary">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface SearchResult {
  label: string;
  hint: string;
  href: string;
}

const SEARCH_INDEX: SearchResult[] = [
  ...PRACTICE_TYPES.map((t) => ({ label: t.title, hint: `${getSkill(t.skill).title} practice`, href: `/practice/${t.slug}` })),
  ...[...PRIMARY_NAV, ...ACCOUNT_NAV].map((n) => ({ label: n.label, hint: "Page", href: n.href })),
  { label: "Reading", hint: "Skill", href: "/practice?skill=reading" },
  { label: "Listening", hint: "Skill", href: "/practice?skill=listening" },
  { label: "Writing", hint: "Skill", href: "/practice?skill=writing" },
  { label: "Speaking", hint: "Skill", href: "/practice?skill=speaking" },
];

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(boxRef, open, close);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter((r) => r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search practice and pages
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        value={query}
        placeholder="Search practice, topics, or pages…"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[active]);
          }
        }}
        className="h-11 w-full rounded-xl border border-line bg-surface-soft pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No matches for “{query}”.</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.href + r.label}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(r);
                }}
                className={cn("flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm", i === active && "bg-primary-soft")}
              >
                <span className="font-semibold text-ink">{r.label}</span>
                <span className="text-xs text-muted">{r.hint}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [batch, setBatch] = useState<GenerationBatchDTO | null | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  useEffect(() => {
    let alive = true;
    api<{ batch: GenerationBatchDTO | null }>("/api/generation/current")
      .then((r) => alive && setBatch(r.batch))
      .catch(() => alive && setBatch(null));
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => {
    const list: { title: string; body: string; href: string }[] = [];
    if (batch) {
      const ready = batch.tasks.filter((t) => t.state === "ready").length;
      const failed = batch.tasks.filter((t) => t.state === "failed").length;
      const working = batch.tasks.filter((t) => t.state === "generating" || t.state === "queued").length;
      if (failed) list.push({ title: "Some practice content needs a retry", body: `${failed} practice type${failed === 1 ? "" : "s"} could not be generated yet.`, href: "/dashboard#generation" });
      if (working) list.push({ title: "Your practice content is being prepared", body: `${ready} of 12 practice types are ready. You can practise now.`, href: "/dashboard#generation" });
      else if (ready) list.push({ title: "Personalised practice is ready", body: `${ready} of 12 practice types have new questions for you.`, href: "/practice" });
    } else if (batch === null) {
      list.push({ title: "Create your study plan", body: "Answer a few questions to get a weekly plan and personalised practice.", href: "/study-plan" });
    }
    list.push({ title: "Starter set available", body: "Hand-written starter questions for all 12 task types are ready to try.", href: "/practice" });
    return list;
  }, [batch]);

  const unread = !seen && items.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setSeen(true);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? "Notifications, new updates" : "Notifications"}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted"
      >
        <Bell className="size-[22px]" aria-hidden />
        {unread && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 top-13 z-40 w-[min(340px,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-2 shadow-xl">
          <p className="px-3 py-2 text-sm font-bold text-ink">Notifications</p>
          <ul className="flex flex-col">
            {items.map((n) => (
              <li key={n.title}>
                <Link href={n.href} onClick={close} className="block rounded-lg px-3 py-2.5 hover:bg-surface-muted">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <p className="text-xs text-muted">{n.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const logout = async () => {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
      toast("You have been logged out.", "info");
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "warning");
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-muted"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-base font-bold text-on-primary" aria-hidden>
          {initials(user.name)}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-semibold text-ink sm:inline">{user.name}</span>
        <ChevronDown className="hidden size-4 text-muted sm:inline" aria-hidden />
        <span className="sr-only">Open account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-13 z-40 w-60 rounded-xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <Link role="menuitem" href="/profile" onClick={close} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-muted">
            <UserRound className="size-4" aria-hidden /> Profile
          </Link>
          <Link role="menuitem" href="/settings" onClick={close} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-muted">
            <Settings className="size-4" aria-hidden /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={logout} disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft disabled:opacity-60">
            <LogOut className="size-4" aria-hidden /> {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
        <button type="button" onClick={onOpenMenu} className="-ml-1 inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted lg:hidden" aria-label="Open menu">
          <Menu className="size-6" />
        </button>
        <Breadcrumbs />
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          <div className="hidden flex-1 justify-end lg:flex">
            <GlobalSearch />
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-expanded={searchOpen}
            aria-controls="mobile-search"
            aria-label={searchOpen ? "Close search" : "Search"}
            className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted lg:hidden"
          >
            <Search className="size-[22px]" aria-hidden />
          </button>
          <Notifications />
          <UserMenu />
        </div>
      </div>
      {searchOpen && (
        <div id="mobile-search" className="border-t border-line px-4 py-2 lg:hidden">
          <GlobalSearch />
        </div>
      )}
    </header>
  );
}
