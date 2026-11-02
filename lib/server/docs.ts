import "server-only";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { DOCS, docHref, type DocEntry } from "@/lib/config/docs";
import { SITE } from "@/lib/config/site";

// Renders the Markdown files listed in lib/config/docs.ts for /docs, at build time. Links and
// images are written for GitHub (relative paths), so they are rewritten here: other docs become
// /docs/<slug>, images are served by /docs/media/<path>, other public repository files link to
// GitHub, and anything git-ignored is shown as plain text.

const ROOT = process.cwd();
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

export interface DocHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedDoc {
  entry: DocEntry;
  html: string;
  headings: DocHeading[];
  readingMinutes: number;
}

export interface SearchSection {
  slug: string;
  docTitle: string;
  heading: string;
  /** Anchor of the section, or "" for the top of the doc. */
  id: string;
  text: string;
}

/** Plain patterns from the repository's .gitignore files (enough for the docs we link to). */
const ignorePatterns: { base: string; pattern: string }[] = [
  { file: ".gitignore", base: "" },
  { file: "docs/.gitignore", base: "docs/" },
].flatMap(({ file, base }) => {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) return [];
  return readFileSync(full, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"))
    .map((pattern) => ({ base, pattern }));
});

function isIgnored(repoPath: string): boolean {
  return ignorePatterns.some(({ base, pattern }) => {
    const anchored = pattern.startsWith("/");
    const p = pattern.replace(/^\//, "").replace(/\/$/, "");
    if (p.includes("*")) {
      const re = new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
      return repoPath.split("/").some((seg) => re.test(seg));
    }
    const target = base + p;
    if (repoPath === target || repoPath.startsWith(`${target}/`)) return true;
    // A pattern without a slash matches that name in any folder below its .gitignore.
    return !anchored && !p.includes("/") && repoPath.startsWith(base) && repoPath.split("/").includes(p);
  });
}

/** A file or folder that exists and would be on GitHub. */
function isPublic(repoPath: string): boolean {
  return !repoPath.startsWith("..") && !isIgnored(repoPath) && existsSync(path.join(ROOT, repoPath));
}

/** Resolves a relative link from a doc to a repository path (without its #hash). */
function resolveRepoPath(fromFile: string, href: string): string {
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), decodeURI(href)));
}

const isExternal = (href: string) => /^(https?:|mailto:|tel:)/i.test(href);

export const mediaUrl = (repoPath: string) => `/docs/media/${repoPath.split("/").map(encodeURIComponent).join("/")}`;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Text of an HTML fragment; `gap` separates blocks such as table cells (used for search text). */
const stripTags = (html: string, gap = "") =>
  html
    .replace(/<[^>]+>/g, gap)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** GitHub-style heading anchors, so links like #2-content-generation--from-… keep working. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function imageSrc(fromFile: string, href: string): string {
  if (isExternal(href) || href.startsWith("/")) return href;
  const repoPath = resolveRepoPath(fromFile, href);
  return isPublic(repoPath) && IMAGE_EXT.test(repoPath) ? mediaUrl(repoPath) : href;
}

/** Where a link in a doc should point, or null when its target is not public. */
function linkHref(fromFile: string, href: string): string | null {
  if (!href || href.startsWith("#") || isExternal(href) || href.startsWith("/")) return href;
  const [target, hash = ""] = href.split("#");
  const repoPath = resolveRepoPath(fromFile, target);
  const doc = DOCS.find((d) => d.file === repoPath);
  if (doc) return docHref(doc.slug) + (hash ? `#${hash}` : "");
  if (!isPublic(repoPath)) return null;
  const kind = statSync(path.join(ROOT, repoPath)).isDirectory() ? "tree" : "blob";
  return `${SITE.githubUrl}/${kind}/main/${repoPath}${hash ? `#${hash}` : ""}`;
}

function render(entry: DocEntry): RenderedDoc {
  const source = readFileSync(path.join(ROOT, entry.file), "utf8");
  const headings: DocHeading[] = [];
  const used = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugify(text) || "section";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const text = stripTags(inner);
        const id = uniqueId(text);
        const level = Math.min(Math.max(depth, 2), 4);
        if (level === 2 || level === 3) headings.push({ depth: level, id, text });
        return `<h${level} id="${id}" class="docs-heading"><a class="docs-anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${level}>\n`;
      },
      paragraph({ tokens }) {
        // A paragraph that is only an image becomes a figure with a caption.
        const only = tokens.filter((t) => !(t.type === "text" && !t.raw.trim()));
        if (only.length === 1 && only[0].type === "image") {
          const img = only[0] as Tokens.Image;
          const alt = escapeHtml(img.text);
          return `<figure class="docs-figure"><button type="button" class="docs-zoom" data-zoom aria-label="Enlarge image: ${alt}"><img src="${imageSrc(entry.file, img.href)}" alt="${alt}" loading="lazy" decoding="async"></button>${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>\n`;
        }
        return false;
      },
      image({ href, text }) {
        return `<img src="${imageSrc(entry.file, href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async">`;
      },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const to = linkHref(entry.file, href);
        if (to === null) return `<span class="docs-unlinked">${inner}</span>`;
        const ext = isExternal(to);
        return `<a href="${escapeHtml(to)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
      },
      code({ text, lang }) {
        const language = (lang ?? "").split(/\s/)[0] || "text";
        return `<div class="docs-code" data-lang="${escapeHtml(language)}"><div class="docs-code-bar"><span>${escapeHtml(language)}</span></div><pre><code>${escapeHtml(text)}</code></pre></div>\n`;
      },
      html({ text }) {
        // Raw HTML in the Markdown (e.g. side-by-side phone screenshots): fix relative image paths.
        return text.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (_m, a: string, src: string, b: string) => `${a}${imageSrc(entry.file, src)}${b} loading="lazy"`);
      },
    },
  });

  // The first H1 is the page title, shown in the page header instead.
  const tokens = marked.lexer(source);
  const h1 = tokens.findIndex((t) => t.type === "heading" && (t as Tokens.Heading).depth === 1);
  if (h1 !== -1) tokens.splice(h1, 1);

  const html = marked.parser(tokens).replace(/<table>/g, '<div class="docs-table"><table>').replace(/<\/table>/g, "</table></div>");
  const words = stripTags(html).split(/\s+/).filter(Boolean).length;
  return { entry, html, headings, readingMinutes: Math.max(1, Math.round(words / 220)) };
}

const cache = new Map<string, RenderedDoc>();

export function getDoc(slug: string): RenderedDoc | null {
  const entry = DOCS.find((d) => d.slug === slug);
  if (!entry) return null;
  if (!cache.has(slug)) cache.set(slug, render(entry));
  return cache.get(slug)!;
}

/** Sections of every doc for the search box: heading plus the start of its text. */
export function getSearchIndex(): SearchSection[] {
  const out: SearchSection[] = [];
  for (const entry of DOCS) {
    const doc = getDoc(entry.slug);
    if (!doc) continue;
    // Split the rendered HTML at each h2/h3 so the text belongs to the right section.
    const parts = doc.html.split(/(?=<h[23] id=")/);
    for (const part of parts) {
      const m = part.match(/^<h[23] id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/);
      const heading = m ? stripTags(m[2]).replace(/^#/, "").trim() : entry.title;
      const body = stripTags(m ? part.slice(m[0].length) : part, " ").replace(/\s+([.,;:!?)])/g, "$1").replace(/\s+/g, " ").trim();
      out.push({ slug: entry.slug, docTitle: entry.title, heading, id: m ? m[1] : "", text: body.slice(0, 240) });
    }
  }
  return out;
}

/** Repository paths of every image the docs show (for the static media route). */
export function getDocMedia(): string[] {
  const found = new Set<string>();
  for (const entry of DOCS) {
    const source = readFileSync(path.join(ROOT, entry.file), "utf8");
    const refs = [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g), ...source.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
    for (const href of refs) {
      if (isExternal(href) || href.startsWith("/")) continue;
      const repoPath = resolveRepoPath(entry.file, href);
      if (IMAGE_EXT.test(repoPath) && isPublic(repoPath)) found.add(repoPath);
    }
  }
  return [...found];
}
