import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { currentAudio } from "@/lib/server/practice";
import { createUser, resetTestDb } from "../support/db";
import { bySlug } from "../support/items";

beforeEach(async () => {
  await resetTestDb();
});

describe("audio made after the page loaded", () => {
  it("returns S3 files for a Listen and Repeat sentence once they are ready, owner only", async () => {
    const u = await createUser("a@example.com");
    const other = await createUser("b@example.com");
    const { media: _m, ...fake } = bySlug("listen-repeat")[0];
    void _m;
    const item = await db.practiceItem.create({ data: { ...(fake as Prisma.PracticeItemUncheckedCreateInput), userId: u.id, source: "generated", contentKey: "audio-test:1" } });

    // The page loaded before the audio job finished: no files yet, so the player would use the browser voice.
    expect(await currentAudio(u.id, item.id, "r1")).toEqual({ assetIds: [], provider: null });

    // The audio job stores the clip in S3 and marks it ready.
    const asset = await db.mediaAsset.create({
      data: { userId: u.id, practiceItemId: item.id, kind: "audio", role: "audio:r1:0", bucket: "test", objectKey: `users/${u.id}/test/r1.mp3`, mimeType: "audio/mpeg", provider: "elevenlabs", status: "ready" },
    });
    expect(await currentAudio(u.id, item.id, "r1")).toEqual({ assetIds: [asset.id], provider: "elevenlabs" });
    expect(await currentAudio(u.id, item.id, "r2")).toEqual({ assetIds: [], provider: null }); // other sentences unaffected
    await expect(currentAudio(other.id, item.id, "r1")).rejects.toMatchObject({ status: 404 });
  });
});
