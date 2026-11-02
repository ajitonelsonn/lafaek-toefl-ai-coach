"use client";

import { Search } from "lucide-react";

export const OPEN_DOCS_SEARCH = "docs:open-search";

/** A large search field look-alike that opens the docs search dialog. */
export function DocsSearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_DOCS_SEARCH))}
      className="flex h-14 w-full max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface px-5 text-left text-muted shadow-[var(--card-shadow)] transition hover:border-primary hover:text-ink"
    >
      <Search className="size-5 text-primary" />
      <span className="flex-1">Search the docs: study plan, mock test, Muse Spark…</span>
      <kbd className="rounded-md border border-line bg-surface-soft px-2 py-0.5 text-xs font-semibold">⌘K</kbd>
    </button>
  );
}
