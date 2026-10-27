import type { MediaAsset, PracticeItem } from "@prisma/client";
import type { PracticeSlug } from "@/lib/config/practice-types";
import { starterEntries } from "@/prisma/starter/convert";
import { toStoredItem, validateGenerated } from "@/lib/server/content/schemas";

/** In-memory practice items built from the starter set (same pipeline as the seed). */
export function fakeItems(): (PracticeItem & { media: MediaAsset[] })[] {
  return starterEntries().map((e, n) => {
    const v = validateGenerated(e.slug, e.output);
    if (!v.ok) throw new Error(`${e.slug}: ${v.errors.join("; ")}`);
    const s = toStoredItem(e.slug, v.value);
    return {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      contentKey: `test:${e.slug}:${e.index}`,
      userId: null,
      studyPlanId: null,
      generationJobId: null,
      source: "starter",
      taskSlug: e.slug,
      itemIndex: e.index,
      difficulty: s.difficulty,
      cefrLevel: s.cefrLevel,
      topic: s.topic,
      contentJson: s.content as never,
      answerKeyJson: s.answerKey as never,
      explanationJson: s.explanation as never,
      rubricJson: s.rubric as never,
      provenanceJson: {} as never,
      validationStatus: "valid",
      validationErrors: null,
      contentVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      media: [],
    };
  });
}

export const bySlug = (slug: PracticeSlug) => fakeItems().filter((i) => i.taskSlug === slug);
