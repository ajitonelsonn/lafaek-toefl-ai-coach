import "server-only";
import { Prisma } from "@prisma/client";
import type { PracticeSlug, SkillId } from "@/lib/config/practice-types";
import type { PracticeView } from "@/lib/practice/dto";
import { db } from "./db";
import { ApiError } from "./http";
import { buildView, type ItemWithMedia } from "./content/view";
import { scoreUnit } from "./content/scoring";

// Short demo-length mock test assembled from the shared starter set. Results are
// practice estimates, never official scores.
export const MOCK_SCORING_VERSION = "mock-1";

export const MOCK_FORM: { skill: SkillId; contentKey: string; units: string[] }[] = [
  { skill: "reading", contentKey: "starter:read-in-daily-life:0:v1", units: ["q1", "q3"] },
  { skill: "reading", contentKey: "starter:read-academic-passage:0:v1", units: ["q1", "q4"] },
  { skill: "listening", contentKey: "starter:listen-choose-response:1:v1", units: ["q1"] },
  { skill: "listening", contentKey: "starter:listen-choose-response:4:v1", units: ["q1"] },
  { skill: "listening", contentKey: "starter:listen-announcement:0:v1", units: ["q3"] },
  { skill: "writing", contentKey: "starter:write-email:1:v1", units: ["w"] },
  { skill: "speaking", contentKey: "starter:take-interview:0:v1", units: ["i2"] },
];

export interface MockFormItem {
  skill: SkillId;
  slug: PracticeSlug;
  units: string[];
  view: PracticeView;
}

export async function getMockForm(sections: SkillId[]): Promise<MockFormItem[]> {
  const wanted = MOCK_FORM.filter((f) => sections.includes(f.skill));
  const rows = (await db.practiceItem.findMany({ where: { contentKey: { in: wanted.map((w) => w.contentKey) } }, include: { media: { where: { deletedAt: null } } } })) as ItemWithMedia[];
  return wanted.flatMap((w) => {
    const row = rows.find((r) => r.contentKey === w.contentKey);
    if (!row) return [];
    return [{ skill: w.skill, slug: row.taskSlug as PracticeSlug, units: w.units, view: buildView(row.taskSlug as PracticeSlug, [row]) }];
  });
}

export async function submitMockTest(userId: string, input: { answers: { itemId: string; unitId: string; response: unknown }[]; sections: SkillId[]; durationSeconds: number }) {
  const wanted = MOCK_FORM.filter((f) => input.sections.includes(f.skill));
  const rows = await db.practiceItem.findMany({ where: { contentKey: { in: wanted.map((w) => w.contentKey) } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sections = input.sections.map((skill) => {
    const forms = wanted.filter((w) => w.skill === skill);
    let correct = 0;
    let total = 0;
    let answered = 0;
    let objective = false;
    let note: string | undefined;
    for (const f of forms) {
      const row = rows.find((r) => r.contentKey === f.contentKey);
      if (!row) continue;
      for (const unit of f.units) {
        total++;
        const a = input.answers.find((x) => x.itemId === row.id && x.unitId === unit);
        if (a) answered++;
        if (a && a.response === null && row.taskSlug !== "take-interview") continue;
        const r = scoreUnit(row.taskSlug as PracticeSlug, row, unit, a?.response);
        if (r.correct !== null) {
          objective = true;
          if (r.correct) correct++;
        } else if (row.taskSlug === "write-email") {
          const body = (a?.response as { body?: string } | undefined)?.body ?? "";
          note = `${body.trim() ? body.trim().split(/\s+/).length : 0} words written. Writing is not auto-scored.`;
        } else {
          note = a ? "Response recorded. Speaking is not auto-scored." : "No response recorded.";
        }
      }
    }
    return { skill, correct: objective ? correct : null, total, answered, ...(note ? { note } : {}) };
  });
  for (const a of input.answers) if (!byId.has(a.itemId)) throw new ApiError(400, "VALIDATION_ERROR", "Please check your answers.");
  return db.mockTestResult.create({
    data: { userId, sectionsJson: sections as unknown as Prisma.InputJsonValue, durationSeconds: Math.min(input.durationSeconds, 4 * 3600), scoringVersion: MOCK_SCORING_VERSION },
  });
}

export async function latestMockResult(userId: string) {
  const r = await db.mockTestResult.findFirst({ where: { userId }, orderBy: { completedAt: "desc" } });
  return r ? { completedAt: r.completedAt.toISOString(), durationSeconds: r.durationSeconds, sections: r.sectionsJson as unknown as { skill: SkillId; correct: number | null; total: number; answered: number; note?: string }[] } : null;
}
