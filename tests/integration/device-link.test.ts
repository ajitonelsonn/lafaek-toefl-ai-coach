import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { cancelShareCodes, claimCode, createShareCode, decideShare, pollClaim, pruneDeviceLinks, shareStatus } from "@/lib/server/auth/device-link";
import { formatCode, normalizeCode } from "@/lib/utils/device-code";
import { createUser, resetTestDb } from "../support/db";

const QUEST_UA = "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/38.0 Chrome/130 VR Safari/537.36";

beforeEach(async () => {
  await resetTestDb();
});

describe("code format", () => {
  it("accepts dashes, spaces and lower case, and rejects look-alike characters", () => {
    expect(normalizeCode("k7qm-3xpa")).toBe("K7QM3XPA");
    expect(normalizeCode(" K7QM 3XPA ")).toBe("K7QM3XPA");
    expect(normalizeCode("K7QM3XP0")).toBeNull(); // zero is not in the alphabet
    expect(normalizeCode("K7QM3XPI")).toBeNull();
    expect(normalizeCode("K7QM3XP")).toBeNull();
    expect(formatCode("k7qm3x")).toBe("K7QM-3X");
  });
});

describe("sign in another device: show code → enter → approve → signed in", () => {
  it("signs the new device in only after the signed-in device approves, exactly once", async () => {
    const user = await createUser("quest@example.com");
    const { id, code, expiresAt } = await createShareCode(user.id);
    expect(normalizeCode(code)).toBe(code);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60_000);
    expect(JSON.stringify(await db.deviceLink.findFirstOrThrow())).not.toContain(code);
    expect(await shareStatus(user.id, id)).toMatchObject({ status: "waiting" });

    const { secret } = await claimCode(formatCode(code).toLowerCase(), QUEST_UA);
    expect(await pollClaim(secret)).toEqual({ status: "pending" });
    expect(await shareStatus(user.id, id)).toMatchObject({ status: "claimed", device: "Meta Quest browser" });

    await decideShare(user.id, id, true);
    expect(await shareStatus(user.id, id)).toEqual({ status: "approved" });
    expect(await pollClaim(secret)).toEqual({ status: "approved", userId: user.id });
    expect(await shareStatus(user.id, id)).toEqual({ status: "signed_in", device: "Meta Quest browser" });
    expect(await pollClaim(secret)).toEqual({ status: "expired" });
  });

  it("a code can be claimed by one device only, and only once", async () => {
    const user = await createUser("quest@example.com");
    const { code } = await createShareCode(user.id);
    await claimCode(code, QUEST_UA);
    await expect(claimCode(code, "someone else")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("deny (or closing the code window) leaves the device signed out", async () => {
    const user = await createUser("quest@example.com");
    const first = await createShareCode(user.id);
    const a = await claimCode(first.code, QUEST_UA);
    await decideShare(user.id, first.id, false);
    expect(await pollClaim(a.secret)).toEqual({ status: "denied" });
    expect(await shareStatus(user.id, first.id)).toEqual({ status: "denied" });
    await expect(decideShare(user.id, first.id, true)).rejects.toMatchObject({ code: "CODE_EXPIRED" });

    const second = await createShareCode(user.id);
    const b = await claimCode(second.code, QUEST_UA);
    await cancelShareCodes(user.id);
    expect(await pollClaim(b.secret)).toEqual({ status: "denied" });
  });

  it("closing the window after approving still lets the device finish signing in", async () => {
    const user = await createUser("quest@example.com");
    const { id, code } = await createShareCode(user.id);
    const { secret } = await claimCode(code, QUEST_UA);
    await decideShare(user.id, id, true);
    await cancelShareCodes(user.id);
    expect(await pollClaim(secret)).toEqual({ status: "approved", userId: user.id });
  });

  it("only the owner can see or approve a code; a new code cancels the old one", async () => {
    const user = await createUser("quest@example.com");
    const other = await createUser("other@example.com");
    const first = await createShareCode(user.id);
    await claimCode(first.code, QUEST_UA);
    await expect(decideShare(other.id, first.id, true)).rejects.toMatchObject({ code: "CODE_EXPIRED" });
    expect(await shareStatus(other.id, first.id)).toEqual({ status: "expired" });

    const second = await createShareCode(user.id);
    expect(await shareStatus(user.id, first.id)).toEqual({ status: "denied" });
    await claimCode(second.code, QUEST_UA);
  });

  it("expired codes, malformed codes and disabled accounts never sign in", async () => {
    const user = await createUser("quest@example.com");
    const { code } = await createShareCode(user.id);
    await db.deviceLink.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(claimCode(code, QUEST_UA)).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(claimCode("hello", QUEST_UA)).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(claimCode("ABCD-EFGH", QUEST_UA)).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(await pollClaim("x".repeat(43))).toEqual({ status: "expired" });

    const again = await createShareCode(user.id);
    const { secret } = await claimCode(again.code, QUEST_UA);
    await decideShare(user.id, again.id, true);
    await db.user.update({ where: { id: user.id }, data: { status: "disabled" } });
    expect(await pollClaim(secret)).toEqual({ status: "expired" });
  });

  it("gives at least 3 minutes to approve after the code is entered, and prunes old rows", async () => {
    const user = await createUser("quest@example.com");
    const { code } = await createShareCode(user.id);
    await db.deviceLink.updateMany({ data: { expiresAt: new Date(Date.now() + 10_000) } });
    const { expiresAt } = await claimCode(code, QUEST_UA);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(2.5 * 60_000);

    await db.deviceLink.updateMany({ data: { expiresAt: new Date(Date.now() - 2 * 86_400_000) } });
    expect(await pruneDeviceLinks()).toBe(1);
  });
});
