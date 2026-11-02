import type { Icon3DName } from "./assets";

/**
 * The documents published at /docs. Each one is a Markdown file in the repository, so the same
 * text reads well on GitHub. Only files listed here are published; git-ignored notes (specs,
 * progress logs, audits) are never added.
 */
export interface DocEntry {
  slug: string;
  /** Repository path of the Markdown file. */
  file: string;
  title: string;
  /** Shorter label for the sidebar. */
  nav: string;
  description: string;
  group: DocGroup;
  icon: Icon3DName;
}

export const DOC_GROUPS = ["Start here", "Using the app", "Technical"] as const;
export type DocGroup = (typeof DOC_GROUPS)[number];

export const DOCS: DocEntry[] = [
  {
    slug: "story",
    file: "hystory/README.md",
    title: "Why I built LafaekTOEFL",
    nav: "Our story",
    description: "Old books, high prices and no feedback in Dili, Timor-Leste, and how the Meta hackathon turned that into a free AI coach.",
    group: "Start here",
    icon: "goal",
  },
  {
    slug: "user-guide",
    file: "docs/user-guide/README.md",
    title: "User guide",
    nav: "User guide",
    description: "A tour of the app with screenshots: study plan, all 12 practice types, vocabulary, progress, mock test and certificates.",
    group: "Using the app",
    icon: "practice",
  },
  {
    slug: "how-it-works",
    file: "docs/diagram/README.md",
    title: "How it works",
    nav: "How it works",
    description: "Architecture diagrams: Vercel, Render, PostgreSQL, AWS S3, every Meta model, the job queue, mock-test scoring and the database.",
    group: "Technical",
    icon: "analytics",
  },
  {
    slug: "developer-guide",
    file: "README.md",
    title: "Developer guide",
    nav: "Developer guide",
    description: "Set up, run and deploy your own copy: environment, commands, upgrades, deployment, data retention and limitations.",
    group: "Technical",
    icon: "settings",
  },
];

export const docHref = (slug: string) => `/docs/${slug}`;
export const getDocEntry = (slug: string) => DOCS.find((d) => d.slug === slug);
