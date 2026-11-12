import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import {
  approveRequest,
  cancelShareCodes,
  consumeShare,
  createRequest,
  createShareCode,
  describeDevice,
  findLiveCode,
  pollRequest,
  pruneDeviceLinks,
} from "@/lib/server/auth/device-link";
import { formatCode, normalizeCode } from "@/lib/utils/device-code";
import { createUser, resetTestDb } from "../support/db";

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

describe("share codes (signed-in device makes a code for another device)", () => {
  it("signs in once, stores only a hash, and then stops working", async () => {
    const user = await createUser("quest@example.com");
    const { code, expiresAt } = await createShareCode(user.id);
    expect(normalizeCode(code)).toBe(code);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60_000);
    const row = await db.deviceLink.findFirstOrThrow();
    expect(JSON.stringify(row)).not.toContain(code);

    const link = await findLiveCode(formatCode(code).toLowerCase());
    expect(await consumeShare(link)).toBe(user.id);
    await expect(findLiveCode(code)).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(consumeShare(link)).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("a new code or closing the window cancels the old one", async () => {
    const user = await createUser("quest@example.com");
    const first = await createShareCode(user.id);
    const second = await createShareCode(user.id);
    await expect(findLiveCode(first.code)).rejects.toMatchObject({ code: "INVALID_CODE" });
    await findLiveCode(second.code);
    await cancelShareCodes(user.id);
    await expect(findLiveCode(second.code)).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("rejects expired codes and codes for disabled accounts", async () => {
    const user = await createUser("quest@example.com");
    const { code } = await createShareCode(user.id);
    await db.deviceLink.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(findLiveCode(code)).rejects.toMatchObject({ code: "INVALID_CODE" });

    const again = await createShareCode(user.id);
    const link = await findLiveCode(again.code);
    await db.user.update({ where: { id: user.id }, data: { status: "disabled" } });
    await expect(consumeShare(link)).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("rejects malformed and unknown codes", async () => {
    await expect(findLiveCode("hello")).rejects.toMatchObject({ code: "INVALID_CODE" });
    await expect(findLiveCode("ABCD-EFGH")).rejects.toMatchObject({ code: "INVALID_CODE" });
  });
});

describe("request codes (headset shows a code, a signed-in phone approves)", () => {
  const questUa = "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/38.0 Chrome/130 VR Safari/537.36";

  it("waits, then signs the waiting device in exactly once after approval", async () => {
    const user = await createUser("quest@example.com");
    const { code, secret } = await createRequest(questUa);
    expect(await pollRequest(secret)).toEqual({ status: "pending" });

    const link = await findLiveCode(code);
    expect(link.kind).toBe("request");
    expect(describeDevice(link.userAgent)).toBe("Meta Quest browser");
    await expect(consumeShare(link)).rejects.toMatchObject({ code: "INVALID_CODE" }); // cannot be used as a share code

    await approveRequest(link, user.id);
    await expect(approveRequest(link, user.id)).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(await pollRequest(secret)).toEqual({ status: "approved", userId: user.id });
    expect(await pollRequest(secret)).toEqual({ status: "expired" });
  });

  it("an unknown secret or an expired request never signs in", async () => {
    const user = await createUser("quest@example.com");
    expect(await pollRequest("x".repeat(43))).toEqual({ status: "expired" });
    const { code, secret } = await createRequest(null);
    const link = await findLiveCode(code);
    await approveRequest(link, user.id);
    await db.deviceLink.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await pollRequest(secret)).toEqual({ status: "expired" });
  });

  it("prunes rows a day after they expire", async () => {
    await createRequest(null);
    await db.deviceLink.updateMany({ data: { expiresAt: new Date(Date.now() - 2 * 86_400_000) } });
    expect(await pruneDeviceLinks()).toBe(1);
  });
});
