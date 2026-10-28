import "server-only";
import { Prisma } from "@prisma/client";
import { PRACTICE_TYPES, getPracticeType, type PracticeSlug } from "@/lib/config/practice-types";
import type { AudioDTO, PracticeSetDTO, UnitResultDTO } from "@/lib/practice/dto";
import { db } from "./db";
import { ApiError } from "./http";
import { buildView, unitIdsOf, type ItemWithMedia } from "./content/view";
import { SCORING_VERSION, isValidResponse, scoreUnit } from "./content/scoring";

const MAX_ITEMS_PER_PAGE = 30;

/** Items a user may see: the shared starter set plus their own validated generated items. */
export function visibleTo(userId: string): Prisma.PracticeItemWhereInput {
  return {
    archivedAt: null,
    validationStatus: "valid",
    OR: [{ source: "starter", userId: null }, { userId }],
  };
}

export async function getPracticeSet(userId: string, slug: PracticeSlug, cursor?: string): Promise<PracticeSetDTO & { nextCursor: string | null }> {
  const rows = await db.practiceItem.findMany({
    where: { ...visibleTo(userId), taskSlug: slug },
    include: { media: { where: { deletedAt: null } } },
    // Personalised items first, then the starter set.
    orderBy: [{ source: "asc" }, { createdAt: "asc" }, { itemIndex: "asc" }],
    take: MAX_ITEMS_PER_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, MAX_ITEMS_PER_PAGE) as ItemWithMedia[];
  const drafts = await db.practiceDraft.findMany({ where: { userId, practiceItemId: { in: page.map((r) => r.id) } } });
  const view = buildView(slug, page, new Map(drafts.map((d) => [d.practiceItemId, d.bodyJson as Record<string, unknown>])));
  return {
    slug,
    view,
    unitCount: page.reduce((n, r) => n + unitIdsOf(slug, r).length, 0),
    generatedCount: page.filter((r) => r.source === "generated").length,
    starterCount: page.filter((r) => r.source === "starter").length,
    nextCursor: rows.length > MAX_ITEMS_PER_PAGE ? page[page.length - 1].id : null,
  };
}

export async function getOwnedItem(userId: string, itemId: string) {
  const item = await db.practiceItem.findFirst({ where: { id: itemId, ...visibleTo(userId) }, include: { media: { where: { deletedAt: null } } } });
  // Same response for "missing" and "not yours", so ids cannot be probed.
  if (!item) throw new ApiError(404, "NOT_FOUND", "This practice item was not found.");
  return item;
}

export async function submitResponses(
  userId: string,
  itemId: string,
  responses: { unitId: string; response: unknown }[],
  durationMs: number | undefined,
): Promise<Record<string, UnitResultDTO>> {
  const item = await getOwnedItem(userId, itemId);
  const slug = item.taskSlug as PracticeSlug;
  const allowed = new Set(unitIdsOf(slug, item));
  const results: Record<string, UnitResultDTO> = {};
  const rows: Prisma.PracticeAttemptCreateManyInput[] = [];
  for (const { unitId, response } of responses) {
    if (!allowed.has(unitId) || !isValidResponse(slug, response)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Please check your answer and try again.");
    }
    const result = scoreUnit(slug, item, unitId, response);
    results[unitId] = result;
    rows.push({
      userId,
      practiceItemId: item.id,
      taskSlug: slug,
      unitId,
      responseJson: response as Prisma.InputJsonValue,
      scoreJson: { correct: result.correct } as Prisma.InputJsonValue,
      feedbackJson: result.checks ? ({ checks: result.checks } as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      durationMs: durationMs ? Math.min(durationMs, 3 * 3_600_000) : null,
      scoringVersion: SCORING_VERSION,
    });
  }
  await db.practiceAttempt.createMany({ data: rows });
  return results;
}

export async function saveDraft(userId: string, itemId: string, body: { to?: string; subject?: string; body: string }) {
  const item = await getOwnedItem(userId, itemId);
  if (item.taskSlug !== "write-email" && item.taskSlug !== "academic-discussion") throw new ApiError(400, "VALIDATION_ERROR", "Drafts are only for writing tasks.");
  await db.practiceDraft.upsert({
    where: { userId_practiceItemId: { userId, practiceItemId: item.id } },
    create: { userId, practiceItemId: item.id, bodyJson: body },
    update: { bodyJson: body },
  });
}

/** Canonical catalog with the user's generated counts. Planned counts are content-pool targets, not ETS item counts. */
export async function getCatalog(userId: string) {
  const counts = await db.practiceItem.groupBy({
    by: ["taskSlug", "source"],
    where: visibleTo(userId),
    _count: { _all: true },
  });
  return PRACTICE_TYPES.map((t) => ({
    slug: t.slug,
    title: t.title,
    skill: t.skill,
    plannedItemCount: t.referenceCount,
    generatedItemCount: counts.find((c) => c.taskSlug === t.slug && c.source === "generated")?._count._all ?? 0,
    starterItemCount: counts.find((c) => c.taskSlug === t.slug && c.source === "starter")?._count._all ?? 0,
    officialExamBlueprint: { section: t.skill, note: "Official TOEFL iBT task counts vary by form; Reading and Listening are adaptive." },
  }));
}

export function assertSlug(slug: string): PracticeSlug {
  if (!getPracticeType(slug)) throw new ApiError(404, "NOT_FOUND", "Unknown practice type.");
  return slug as PracticeSlug;
}

/**
 * Audio files for one segment of an item, read fresh from the database. The page may have loaded
 * before the audio job finished; the player asks here before falling back to the browser voice.
 * Returns file ids only (never the script).
 */
export async function currentAudio(userId: string, itemId: string, role: string): Promise<{ assetIds: string[]; provider: string | null }> {
  const item = await getOwnedItem(userId, itemId);
  const view = buildView(item.taskSlug as PracticeSlug, [item]);
  let found: AudioDTO | null = null;
  const walk = (v: unknown) => {
    if (found || !v || typeof v !== "object") return;
    const a = v as Partial<AudioDTO>;
    if (a.source?.itemId === itemId && a.source.role === role && Array.isArray(a.assetIds)) {
      found = a as AudioDTO;
      return;
    }
    Object.values(v).forEach(walk);
  };
  walk(view);
  const audio = found as AudioDTO | null;
  return { assetIds: audio?.assetIds ?? [], provider: audio?.provider ?? null };
}
