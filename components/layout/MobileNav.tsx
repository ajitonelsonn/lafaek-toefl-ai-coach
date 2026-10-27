"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NavLinks } from "./NavLinks";
import { cn } from "@/lib/utils/cn";

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("a,button");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "visible" : "invisible")} aria-hidden={!open}>
      <div className={cn("absolute inset-0 bg-brand-950/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col overflow-y-auto bg-surface px-3 py-4 shadow-2xl transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <Logo href="/dashboard" size={38} />
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface-muted hover:text-ink" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        {open && <NavLinks onNavigate={onClose} />}
      </div>
    </div>
  );
}
