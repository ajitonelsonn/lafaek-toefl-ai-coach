"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookA, BookOpen, CalendarDays, ChartNoAxesColumn, Gauge, LayoutDashboard, Settings, Target, UserRound, type LucideIcon } from "lucide-react";
import { ACCOUNT_NAV, PRIMARY_NAV, type NavIcon, type NavItem } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  practice: BookOpen,
  "study-plan": CalendarDays,
  vocabulary: BookA,
  "mock-test": Target,
  progress: ChartNoAxesColumn,
  usage: Gauge,
  profile: UserRound,
  settings: Settings,
};

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const Icon = ICONS[item.icon];
  const active = isActivePath(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors",
          active ? "bg-primary-soft text-primary" : "text-ink/85 hover:bg-surface-muted hover:text-ink",
        )}
      >
        {active && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-primary" />}
        <Icon className="size-5 shrink-0" aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </ul>
      <div className="mx-4 border-t border-line" />
      <ul className="flex flex-col gap-1">
        {ACCOUNT_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}
