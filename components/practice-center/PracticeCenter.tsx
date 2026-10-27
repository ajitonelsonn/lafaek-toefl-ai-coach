"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronUp, Search } from "lucide-react";
import { PRACTICE_TYPES, SKILLS, practiceHref, type SkillId } from "@/lib/config/practice-types";
import { sampleCount } from "@/lib/mock-data/questions";
import { useDemoState } from "@/lib/store/demo-store";
import { ChipGroup } from "@/components/ui/Segmented";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { GenerationBadge, jobFor } from "@/components/generation/GenerationStatus";
import { SKILL_TONE, SkillIconTile } from "@/components/practice/icons";
import { cn } from "@/lib/utils/cn";

type Filter = "all" | SkillId;

export function PracticeCenter({ initialSkill }: { initialSkill: Filter }) {
  const router = useRouter();
  const pathname = usePathname();
  const { completedUnits, generationJobs } = useDemoState();
  const [filter, setFilter] = useState<Filter>(initialSkill);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const changeFilter = (f: Filter) => {
    setFilter(f);
    router.replace(f === "all" ? pathname : `${pathname}?skill=${f}`, { scroll: false });
  };

  const q = query.trim().toLowerCase();
  const visibleSkills = SKILLS.filter((s) => filter === "all" || s.id === filter);
  const matches = useMemo(
    () => PRACTICE_TYPES.filter((t) => !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.skill.includes(q)),
    [q],
  );
  const anyVisible = visibleSkills.some((s) => matches.some((t) => t.skill === s.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChipGroup
          label="Filter by skill"
          value={filter}
          onChange={changeFilter}
          options={[{ value: "all", label: "All" }, ...SKILLS.map((s) => ({ value: s.id, label: s.title }))]}
        />
        <div className="relative w-full sm:w-72">
          <label htmlFor="practice-search" className="sr-only">
            Search practice types
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="practice-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search practice types…"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
          />
        </div>
      </div>

      {!anyVisible && (
        <EmptyState
          title="No practice types match your search"
          description="Try a different word, or clear the search to see all 12 practice types."
          action={
            <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => { setQuery(""); changeFilter("all"); }}>
              Show all practice types
            </button>
          }
        />
      )}

      {visibleSkills.map((skill) => {
        const types = matches.filter((t) => t.skill === skill.id);
        if (!types.length) return null;
        const tone = SKILL_TONE[skill.id];
        const isCollapsed = collapsed[skill.id];
        const total = PRACTICE_TYPES.filter((t) => t.skill === skill.id).length;
        return (
          <section key={skill.id} aria-labelledby={`skill-${skill.id}`} className={cn("rounded-2xl border p-3 sm:p-4", tone.border, tone.soft)}>
            <div className="flex flex-wrap items-center gap-3 px-1 pb-3">
              <SkillIconTile skill={skill.id} size="md" className="bg-surface" />
              <h2 id={`skill-${skill.id}`} className="text-xl font-bold text-ink">
                {skill.title}
              </h2>
              <p className="hidden min-w-0 flex-1 text-sm text-muted md:block">{skill.description}</p>
              <div className="ml-auto flex items-center gap-2">
                <StatusBadge tone="primary" className="bg-surface">
                  {total} practice types
                </StatusBadge>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [skill.id]: !c[skill.id] }))}
                  aria-expanded={!isCollapsed}
                  aria-controls={`skill-list-${skill.id}`}
                  aria-label={isCollapsed ? `Show ${skill.title} practice types` : `Hide ${skill.title} practice types`}
                  className={cn("inline-flex size-9 items-center justify-center rounded-full bg-surface shadow-sm", tone.text)}
                >
                  <ChevronUp className={cn("size-4 transition-transform", isCollapsed && "rotate-180")} />
                </button>
              </div>
            </div>
            {!isCollapsed && (
              <ul id={`skill-list-${skill.id}`} className={cn("grid gap-3", types.length === 2 ? "md:grid-cols-2" : types.length === 4 ? "md:grid-cols-2 2xl:grid-cols-4" : "md:grid-cols-3")}>
                {types.map((t) => {
                  const count = sampleCount(t.slug);
                  const done = Math.min(count, completedUnits[t.slug]?.length ?? 0);
                  const job = jobFor(generationJobs, t.slug);
                  return (
                    <li key={t.slug}>
                      <Link
                        href={practiceHref(t.slug)}
                        className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary"
                      >
                        <div className="flex items-start gap-3">
                          <SkillIconTile skill={t.skill} slug={t.slug} size="md" />
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-ink group-hover:text-primary">{t.title}</h3>
                            <p className="mt-0.5 text-sm text-muted">{t.description}</p>
                          </div>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center gap-2">
                          {job ? <GenerationBadge state={job.state} /> : <StatusBadge tone="success">Sample ready</StatusBadge>}
                          <span className="text-xs text-muted">{t.referenceCount} planned</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-12 shrink-0 text-sm font-semibold text-ink tabular-nums">
                            {done}/{count}
                          </span>
                          <ProgressBar value={done} max={count} tone={done === count ? "success" : tone.tone} label={`${t.title}: ${done} of ${count} sample questions practised`} size="sm" />
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-on-primary" aria-hidden>
                            <ArrowRight className="size-4" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
