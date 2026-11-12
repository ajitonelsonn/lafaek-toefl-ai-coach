import { beforeEach, describe, expect, it, vi } from "vitest";

// createSession sets a cookie through next/headers; tests run outside a request.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

import { db } from "@/lib/server/db";
import { createSession, deviceUsage, listDevices, MAX_DEVICES, revokeDevice, revokeOtherDevices } from "@/lib/server/auth/session";
import { describeDevice } from "@/lib/utils/user-agent";
import { createUser, resetTestDb } from "../support/db";

const UA = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
  quest: "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/38.0 Chrome/130.0 VR Safari/537.36",
};

/** Signs in one device; spaced out so "used longest ago" is well defined. */
async function signIn(userId: string, ua: string, minutesAgo: number) {
  await createSession(userId, ua);
  const s = await db.session.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (minutesAgo) await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(Date.now() - minutesAgo * 60_000) } });
  return s.id;
}

beforeEach(async () => {
  await resetTestDb();
  jar.clear();
});

describe("device names", () => {
  it("names common browsers", () => {
    expect(describeDevice(UA.mac)).toEqual({ label: "Chrome on Mac", kind: "computer" });
    expect(describeDevice(UA.iphone)).toEqual({ label: "Safari on iPhone", kind: "phone" });
    expect(describeDevice(UA.windows)).toEqual({ label: "Edge on Windows", kind: "computer" });
    expect(describeDevice(UA.quest)).toEqual({ label: "Meta Quest browser", kind: "vr" });
    expect(describeDevice(null)).toEqual({ label: "Unknown device", kind: "unknown" });
  });
});

describe("3-device limit", () => {
  it("a 4th sign-in signs out the device used longest ago", async () => {
    expect(MAX_DEVICES).toBe(3);
    const user = await createUser("devices@example.com");
    const windows = await signIn(user.id, UA.windows, 300);
    await signIn(user.id, UA.mac, 60);
    await signIn(user.id, UA.iphone, 5);
    expect(await deviceUsage(user.id)).toEqual({ count: 3, max: 3, willSignOut: "Edge on Windows" });

    const quest = await signIn(user.id, UA.quest, 0);
    const active = await db.session.findMany({ where: { userId: user.id, revokedAt: null } });
    expect(active).toHaveLength(3);
    expect(active.map((s) => s.id)).toContain(quest);
    expect(active.map((s) => s.id)).not.toContain(windows);
    expect((await listDevices(user.id, quest)).map((d) => [d.label, d.current])).toEqual([
      ["Meta Quest browser", true],
      ["Safari on iPhone", false],
      ["Chrome on Mac", false],
    ]);
  });

  it("under the limit nothing is signed out, and other accounts are not affected", async () => {
    const a = await createUser("a@example.com");
    const b = await createUser("b@example.com");
    for (const ua of [UA.mac, UA.iphone, UA.windows]) await signIn(b.id, ua, 10);
    await signIn(a.id, UA.mac, 0);
    await signIn(a.id, UA.quest, 0);
    expect(await deviceUsage(a.id)).toEqual({ count: 2, max: 3, willSignOut: null });
    expect(await db.session.count({ where: { userId: b.id, revokedAt: null } })).toBe(3);
  });

  it("signs out one device (only your own) or all others", async () => {
    const user = await createUser("devices@example.com");
    const other = await createUser("other@example.com");
    const mac = await signIn(user.id, UA.mac, 10);
    const phone = await signIn(user.id, UA.iphone, 5);
    const quest = await signIn(user.id, UA.quest, 0);
    const stranger = await signIn(other.id, UA.windows, 0);

    expect(await revokeDevice(user.id, stranger)).toBe(false);
    expect(await revokeDevice(user.id, phone)).toBe(true);
    expect(await revokeDevice(user.id, phone)).toBe(false);
    expect(await revokeOtherDevices(user.id, quest)).toBe(1);
    expect((await listDevices(user.id, quest)).map((d) => d.id)).toEqual([quest]);
    expect(mac).toBeTruthy();
    expect(await db.session.count({ where: { userId: other.id, revokedAt: null } })).toBe(1);
  });
});
