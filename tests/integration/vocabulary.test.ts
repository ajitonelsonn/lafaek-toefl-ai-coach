import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { listVocabulary, wordAudioUrl } from "@/lib/server/vocabulary";
import { createUser, resetTestDb } from "../support/db";

beforeEach(async () => {
  await resetTestDb();
});

async function addWord(userId: string) {
  return db.vocabularyWord.create({
    data: { userId, taskSlug: "read-academic-passage", word: "hypothesis", wordNormalized: "hypothesis", partOfSpeech: "noun", pronunciation: "/haɪˈpɒθəsɪs/", meaning: "an idea that can be tested", example: "Her hypothesis was correct.", category: "science" },
  });
}

describe("vocabulary", () => {
  it("lists only the learner's own words", async () => {
    const a = await createUser("a@example.com");
    const b = await createUser("b@example.com");
    await addWord(a.id);
    expect((await listVocabulary(a.id)).map((w) => w.word)).toEqual(["hypothesis"]);
    expect(await listVocabulary(b.id)).toEqual([]);
  });

  it("word audio is owner-only and reports missing voice configuration instead of failing silently", async () => {
    const a = await createUser("a@example.com");
    const b = await createUser("b@example.com");
    const w = await addWord(a.id);
    await expect(wordAudioUrl(b.id, w.id)).rejects.toMatchObject({ status: 404 });
    // The test environment has no ElevenLabs key or bucket, so the browser voice is the fallback.
    await expect(wordAudioUrl(a.id, w.id)).rejects.toMatchObject({ status: 503, code: "CONFIGURATION_MISSING" });
  });
});
