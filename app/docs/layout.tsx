import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./docs.css";
import { DocsChrome, type DocsNavGroup } from "@/components/docs/DocsChrome";
import { DOCS, DOC_GROUPS } from "@/lib/config/docs";
import { SITE } from "@/lib/config/site";
import { getDoc, getSearchIndex } from "@/lib/server/docs";

export const metadata: Metadata = {
  title: { default: `Docs · ${SITE.shortName}`, template: `%s · ${SITE.shortName} Docs` },
  description: `How ${SITE.name} works: the story behind it, a user guide with screenshots, architecture diagrams and the developer guide.`,
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  const groups: DocsNavGroup[] = DOC_GROUPS.map((group) => ({
    group,
    items: DOCS.filter((d) => d.group === group).map((d) => ({
      slug: d.slug,
      nav: d.nav,
      icon: d.icon,
      headings: (getDoc(d.slug)?.headings ?? []).filter((h) => h.depth === 2).map(({ id, text }) => ({ id, text })),
    })),
  }));
  return (
    <DocsChrome groups={groups} index={getSearchIndex()}>
      {children}
    </DocsChrome>
  );
}
