// Seeds the shared, hand-written Starter set into practice_items (idempotent).
// Each entry passes the same validators as AI-generated content.
import { PrismaClient, Prisma } from "@prisma/client";
import { starterEntries } from "../prisma/starter/convert";
import { toStoredItem, validateGenerated } from "../lib/server/content/schemas";

const db = new PrismaClient();

async function main() {
  let ok = 0;
  const failures: string[] = [];
  for (const entry of starterEntries()) {
    const v = validateGenerated(entry.slug, entry.output);
    if (!v.ok) {
      failures.push(`${entry.slug}#${entry.index}: ${v.errors.join("; ")}`);
      continue;
    }
    const stored = toStoredItem(entry.slug, v.value);
    const contentKey = `starter:${entry.slug}:${entry.index}:v1`;
    const data = {
      source: "starter" as const,
      taskSlug: entry.slug,
      itemIndex: entry.index,
      difficulty: stored.difficulty,
      cefrLevel: stored.cefrLevel,
      topic: stored.topic,
      contentJson: { ...stored.content, ...entry.extraContent } as Prisma.InputJsonValue,
      answerKeyJson: stored.answerKey as Prisma.InputJsonValue,
      explanationJson: stored.explanation as Prisma.InputJsonValue,
      rubricJson: (stored.rubric ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      provenanceJson: { source: "starter", author: "LafaekTOEFL team (hand-written)", promptVersion: null, modelId: null } as Prisma.InputJsonValue,
      validationStatus: "valid" as const,
      contentVersion: 1,
    };
    await db.practiceItem.upsert({ where: { contentKey }, create: { contentKey, ...data }, update: data });
    ok++;
  }
  console.log(`starter items upserted: ${ok}`);
  if (failures.length) {
    console.error(`starter items rejected by validation (${failures.length}):\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main().finally(() => db.$disconnect());
