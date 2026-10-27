import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { MOCK_BLUEPRINT, MOCK_SECTION_ORDER } from "@/lib/config/mock-test";
import type { PracticeSlug, SkillId } from "@/lib/config/practice-types";
import { estimateBandFromAccuracy, overallBand } from "@/lib/config/toefl-scale";
import type { PracticeView, WritingCheckDTO } from "@/lib/practice/dto";
import { db } from "./db";
import { requireEnv } from "./env";
import { ApiError } from "./http";
import { visibleTo } from "./practice";
import { buildView, unitIdsOf, type ItemWithMedia } from "./content/view";
import { scoreUnit } from "./content/scoring";

// Mock test assembled per learner and per attempt: for each section in MOCK_BLUEPRINT it takes the
// learner's own AI-generated questions that earlier mock tests have not used (fewest practised
// first), and falls back to the shared starter set. The chosen form is signed (HMAC) and returned
// to the browser, so submission can only score exactly those questions, once. Results are practice
// estimates, never official scores.
export const MOCK_SCORING_VERSION = "mock-2";
const FORM_TTL_MS = 8 * 3600_000;

export interface MockFormItem {
  skill: SkillId;
  slug: PracticeSlug;
  units: string[];
  view: PracticeView;
}

export interface MockSectionResult {
  skill: SkillId;
  correct: number | null;
  total: number;
  answered: number;
  /** Rough practice band (1–6) for auto-scored sections. */
  band: number | null;
  note?: string;
  checks?: WritingCheckDTO[];
}

export interface MockResult {
  id: string;
  completedAt: string;
  durationSeconds: number;
  sections: MockSectionResult[];
  /** Average of the auto-scored section bands (Reading/Listening), when there is at least one. */
  estimatedBand: number | null;
  /** Share of questions that came from the learner's personalised practice. */
  personalised: number;
}

interface FormPayload {
  v: 2;
  id: string;
  u: string;
  t: number;
  s: SkillId[];
  f: [itemId: string, skill: SkillId, units: string[]][];
}

// --- signed form token ---------------------------------------------------------------------
const sign = (body: string) => createHmac("sha256", requireEnv("AUTH_SECRET").AUTH_SECRET).update(`mock-form:${body}`).digest("base64url");

function encodeForm(p: FormPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeForm(token: string, userId: string): FormPayload {
  const [body, mac] = token.split(".");
  const expected = body ? sign(body) : "";
  const ok = !!body && !!mac && mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  const p = ok ? (JSON.parse(Buffer.from(body, "base64url").toString()) as FormPayload) : null;
  if (!p || p.v !== 2 || p.u !== userId) throw new ApiError(400, "VALIDATION_ERROR", "This test could not be checked. Please start a new mock test.");
  if (Date.now() - p.t > FORM_TTL_MS) throw new ApiError(400, "VALIDATION_ERROR", "This test has expired. Please start a new mock test.");
  return p;
}

// --- stored results (format 1: array of sections; format 2: object) -------------------------
type Stored = MockSectionResult[] | { format: 2; formId: string; itemIds: string[]; personalised: number; estimatedBand: number | null; sections: MockSectionResult[] };

function toResult(row: { id: string; completedAt: Date; durationSeconds: number; sectionsJson: Prisma.JsonValue }): MockResult {
  const s = row.sectionsJson as unknown as Stored;
  const sections = (Array.isArray(s) ? s : s.sections).map((x) => ({ ...x, band: x.band ?? (x.correct !== null ? estimateBandFromAccuracy(x.correct, x.total) : null) }));
  const bands = sections.map((x) => x.band).filter((b): b is number => b !== null);
  return {
    id: row.id,
    completedAt: row.completedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    sections,
    estimatedBand: Array.isArray(s) ? (bands.length ? overallBand(bands) : null) : s.estimatedBand,
    personalised: Array.isArray(s) ? 0 : s.personalised,
  };
}

const usedItemIds = async (userId: string) =>
  new Set(
    (await db.mockTestResult.findMany({ where: { userId }, select: { sectionsJson: true }, orderBy: { completedAt: "desc" }, take: 50 })).flatMap((r) => {
      const s = r.sectionsJson as unknown as Stored;
      return Array.isArray(s) ? [] : s.itemIds;
    }),
  );

/** Builds a new mock test for the learner and returns it with its signed token. */
export async function createMockForm(userId: string, sections: SkillId[]): Promise<{ token: string; items: MockFormItem[] }> {
  const ordered = MOCK_SECTION_ORDER.filter((s) => sections.includes(s));
  const [used, attempted] = await Promise.all([usedItemIds(userId), db.practiceAttempt.findMany({ where: { userId }, select: { practiceItemId: true }, distinct: ["practiceItemId"] })]);
  const practised = new Set(attempted.map((a) => a.practiceItemId));
  const items: MockFormItem[] = [];

  for (const skill of ordered) {
    for (const part of MOCK_BLUEPRINT[skill]) {
      const rows = (await db.practiceItem.findMany({ where: { ...visibleTo(userId), taskSlug: part.slug }, include: { media: { where: { deletedAt: null } } } })) as ItemWithMedia[];
      // Personal before starter, unused in mock tests before used, unpractised before practised; random within a tier.
      const rank = (r: ItemWithMedia) => (r.userId ? 0 : 4) + (used.has(r.id) ? 2 : 0) + (practised.has(r.id) ? 1 : 0);
      const picked = rows
        .map((r) => ({ r, k: rank(r) + Math.random() * 0.5 }))
        .sort((a, b) => a.k - b.k)
        .slice(0, part.items)
        .map((x) => x.r);
      for (const row of picked) {
        const units = unitIdsOf(part.slug, row).slice(0, part.unitsPerItem);
        if (units.length) items.push({ skill, slug: part.slug, units, view: buildView(part.slug, [row]) });
      }
    }
  }
  const payload: FormPayload = { v: 2, id: randomUUID(), u: userId, t: Date.now(), s: ordered, f: items.map((i) => [itemIdOf(i.view), i.skill, i.units]) };
  return { token: encodeForm(payload), items };
}

/** The single item id inside a one-item view. */
function itemIdOf(view: PracticeView): string {
  const first = (view as { items: { itemId: string }[] }).items[0];
  return first.itemId;
}

export async function submitMockTest(userId: string, input: { token: string; answers: { itemId: string; unitId: string; response: unknown }[]; durationSeconds: number }) {
  const form = decodeForm(input.token, userId);
  const done = await db.mockTestResult.count({ where: { userId, sectionsJson: { path: ["formId"], equals: form.id } } });
  if (done) throw new ApiError(409, "CONFLICT", "This test was already submitted.");

  const ids = [...new Set(form.f.map(([id]) => id))];
  const rows = await db.practiceItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const answerFor = (itemId: string, unitId: string) => input.answers.find((a) => a.itemId === itemId && a.unitId === unitId);

  const sections: MockSectionResult[] = form.s.map((skill) => {
    let correct = 0;
    let total = 0;
    let answered = 0;
    let objective = false;
    let note: string | undefined;
    let checks: WritingCheckDTO[] | undefined;
    for (const [itemId, s, units] of form.f) {
      if (s !== skill) continue;
      const row = byId.get(itemId);
      if (!row) continue;
      const slug = row.taskSlug as PracticeSlug;
      for (const unit of units) {
        total++;
        const a = answerFor(itemId, unit);
        if (a) answered++;
        if (slug === "take-interview" || slug === "listen-repeat") continue; // recorded, not scored
        const r = scoreUnit(slug, row, unit, a?.response);
        if (r.correct !== null) {
          objective = true;
          if (r.correct) correct++;
        } else if (r.checks) {
          checks = r.checks;
          const body = (a?.response as { body?: string } | undefined)?.body ?? "";
          note = `${body.trim() ? body.trim().split(/\s+/).length : 0} words written. Checked for length and structure, not AI scored.`;
        }
      }
    }
    if (skill === "speaking") note = answered ? `${answered} of ${total} answers recorded. Speaking is not auto-scored.` : "No answers recorded.";
    const band = objective ? estimateBandFromAccuracy(correct, total) : null;
    return { skill, correct: objective ? correct : null, total, answered, band, ...(note ? { note } : {}), ...(checks ? { checks } : {}) };
  });

  const bands = sections.map((s) => s.band).filter((b): b is number => b !== null);
  const personalised = rows.length ? rows.filter((r) => r.userId === userId).length / rows.length : 0;
  const stored: Stored = { format: 2, formId: form.id, itemIds: ids, personalised, estimatedBand: bands.length ? overallBand(bands) : null, sections };
  const row = await db.mockTestResult.create({
    data: { userId, sectionsJson: stored as unknown as Prisma.InputJsonValue, durationSeconds: Math.min(input.durationSeconds, 4 * 3600), scoringVersion: MOCK_SCORING_VERSION },
  });
  return toResult(row);
}

/** The learner's mock tests, newest first. */
export async function mockHistory(userId: string, take = 20): Promise<MockResult[]> {
  const rows = await db.mockTestResult.findMany({ where: { userId }, orderBy: { completedAt: "desc" }, take });
  return rows.map(toResult);
}

export async function latestMockResult(userId: string): Promise<MockResult | null> {
  return (await mockHistory(userId, 1))[0] ?? null;
}
