"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CornerDownLeft, FileText, Hash, Search } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/client/motion";
import { cn } from "@/lib/utils/cn";

export interface SearchSection {
  slug: string;
  docTitle: string;
  heading: string;
  id: string;
  text: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every word must appear somewhere in the section; heading matches count more. */
function find(index: SearchSection[], query: string): SearchSection[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return index.filter((s) => s.id === "");
  return index
    .map((s) => {
      const heading = s.heading.toLowerCase();
      const all = `${s.docTitle} ${heading} ${s.text}`.toLowerCase();
      if (!terms.every((t) => all.includes(t))) return null;
      const score = terms.reduce((n, t) => n + (heading.includes(t) ? 3 : 0) + (s.docTitle.toLowerCase().includes(t) ? 1 : 0) + 1, 0);
      return { s, score };
    })
    .filter((r): r is { s: SearchSection; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((r) => r.s);
}

function highlight(text: string, query: string): ReactNode {
  const terms = query.split(/\s+/).filter(Boolean).map(escapeRe);
  if (!terms.length) return text;
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "gi"));
  return parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-primary-soft text-primary">{p}</mark> : p));
}

/** A short piece of the section text around the first match. */
function snippet(text: string, query: string): string {
  const first = query.toLowerCase().split(/\s+/).find(Boolean);
  const at = first ? text.toLowerCase().indexOf(first) : -1;
  if (at < 60) return text.slice(0, 140);
  return `…${text.slice(at - 50, at + 100)}`;
}

/** The ⌘K search dialog over all docs. */
export function DocsSearch({ open, onClose, index }: { open: boolean; onClose: () => void; index: SearchSection[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => find(index, query), [index, query]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    input.current?.focus();
    document.body.style.overflow = "hidden";
    if (panel.current && !prefersReducedMotion()) gsap.fromTo(panel.current, { y: -16, scale: 0.98, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.28, ease: "power3.out" });
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const go = (s: SearchSection) => {
    onClose();
    router.push(`/docs/${s.slug}${s.id ? `#${s.id}` : ""}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((n) => Math.min(n + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((n) => Math.max(n - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      go(results[selected]);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search the docs">
      <button type="button" className="absolute inset-0 bg-brand-950/45 backdrop-blur-sm" aria-label="Close search" onClick={onClose} />
      <div ref={panel} className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 shrink-0 text-primary" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: study plan, mock test, Muse Spark, deploy…"
            className="h-14 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="docs-search-results"
            aria-activedescendant={results[selected] ? `docs-result-${selected}` : undefined}
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold text-muted">Esc</kbd>
        </div>
        <ul id="docs-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No results for “{query}”. Try another word.</li>}
          {results.map((s, i) => (
            <li key={`${s.slug}#${s.id}`} id={`docs-result-${i}`} role="option" aria-selected={i === selected}>
              <button
                type="button"
                onMouseMove={() => setSelected(i)}
                onClick={() => go(s)}
                className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left", i === selected ? "bg-primary-soft" : "hover:bg-surface-muted")}
              >
                <span className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg", i === selected ? "bg-primary text-on-primary" : "bg-surface-muted text-muted")}>
                  {s.id ? <Hash className="size-4" /> : <FileText className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{s.docTitle}</span>
                  <span className="block truncate font-semibold text-ink">{highlight(s.heading, query)}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{highlight(snippet(s.text, query), query)}</span>
                </span>
                {i === selected && <CornerDownLeft className="mt-2 size-4 shrink-0 text-primary" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-surface-soft px-5 py-2.5 text-xs text-muted">
          <span>
            <kbd className="font-semibold">↑ ↓</kbd> to move
          </span>
          <span>
            <kbd className="font-semibold">Enter</kbd> to open
          </span>
          <span className="ml-auto">{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
