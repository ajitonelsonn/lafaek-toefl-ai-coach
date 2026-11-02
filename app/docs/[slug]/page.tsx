import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, ExternalLink, ListTree } from "lucide-react";
import { DocEnhancer } from "@/components/docs/DocEnhancer";
import { DocsMotion } from "@/components/docs/DocsMotion";
import { DocToc } from "@/components/docs/DocToc";
import { IconTile } from "@/components/ui/Icon3D";
import { DOCS, docHref } from "@/lib/config/docs";
import { SITE } from "@/lib/config/site";
import { getDoc } from "@/lib/server/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return doc ? { title: doc.entry.title, description: doc.entry.description } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();
  const { entry, html, headings, readingMinutes } = doc;
  const at = DOCS.findIndex((d) => d.slug === entry.slug);
  const prev = DOCS[at - 1];
  const next = DOCS[at + 1];
  const source = `${SITE.githubUrl}/blob/main/${entry.file}`;

  return (
    <div className="flex gap-12 px-4 pb-16 pt-8 sm:px-8 lg:px-12 xl:pt-12">
      <DocsMotion />
      <DocEnhancer />
      <article className="mx-auto min-w-0 max-w-[50rem] flex-1 xl:mx-0">
        <header data-docs-in className="border-b border-line pb-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Link href="/docs" className="hover:text-primary">
              Docs
            </Link>
            <span aria-hidden>/</span>
            <span>{entry.group}</span>
          </nav>
          <div className="mt-5 flex items-center gap-4">
            <IconTile name={entry.icon} size={60} />
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-[2.6rem] sm:leading-[1.1]">{entry.title}</h1>
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-body">{entry.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 font-semibold text-muted">
              <Clock className="size-3.5" /> {readingMinutes} min read
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 font-semibold text-muted">
              <ListTree className="size-3.5" /> {headings.filter((h) => h.depth === 2).length} sections
            </span>
            <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-primary hover:bg-primary-soft">
              View on GitHub <ExternalLink className="size-3.5" />
            </a>
          </div>
        </header>

        {headings.length > 0 && (
          <details className="group mt-6 rounded-2xl border border-line bg-surface px-5 py-3 xl:hidden">
            <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">
              <span className="inline-flex items-center gap-2">
                <ListTree className="size-4 text-primary" /> On this page
              </span>
            </summary>
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[15px]">
              {headings.map((h) => (
                <li key={h.id} className={h.depth === 3 ? "pl-4" : ""}>
                  <a href={`#${h.id}`} className="block py-1 text-muted hover:text-primary">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div id="doc-body" className="docs-prose mt-10" dangerouslySetInnerHTML={{ __html: html }} />

        <nav aria-label="More docs" className="mt-16 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={docHref(prev.slug)} className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--card-shadow)]">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" /> Previous
              </span>
              <span className="mt-1 block text-lg font-bold text-ink group-hover:text-primary">{prev.title}</span>
            </Link>
          ) : (
            <Link href="/docs" className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                <ArrowLeft className="size-4" /> Back to
              </span>
              <span className="mt-1 block text-lg font-bold text-ink group-hover:text-primary">Docs overview</span>
            </Link>
          )}
          {next && (
            <Link href={docHref(next.slug)} className="group rounded-2xl border border-line bg-surface p-5 text-right transition hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--card-shadow)]">
              <span className="flex items-center justify-end gap-1.5 text-sm font-semibold text-muted">
                Next <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="mt-1 block text-lg font-bold text-ink group-hover:text-primary">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden w-60 shrink-0 xl:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6">
          <DocToc headings={headings} />
          <a href={source} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
            Edit this page on GitHub <ExternalLink className="size-3.5" />
          </a>
        </div>
      </aside>
    </div>
  );
}
