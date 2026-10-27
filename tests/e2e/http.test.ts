// HTTP end-to-end tests against a running server that uses the isolated test schema:
//   DATABASE_URL="<url>&schema=lafaek_test" npx next start -p 3200
//   E2E_BASE_URL=http://localhost:3200 npx vitest run tests/e2e
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/crypto";
import { resetTestDb } from "../support/db";
import { execSync } from "node:child_process";

const BASE = process.env.E2E_BASE_URL;
const run = BASE ? describe : describe.skip;
const ORIGIN = { Origin: BASE ?? "" };

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", ...ORIGIN }, body: JSON.stringify({ email, password }) });
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie") ?? "";
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=lax/i);
  return cookie.split(";")[0];
}

run("HTTP end-to-end", () => {
  let cookieA = "";
  let cookieB = "";

  beforeAll(async () => {
    await resetTestDb();
    execSync("npx tsx --conditions=react-server scripts/seed-starter.ts", { env: process.env, stdio: "ignore" });
    for (const [email, name] of [["a@example.com", "Ana"], ["b@example.com", "Ben"]]) {
      await db.user.create({ data: { emailNormalized: email, displayName: name, status: "active", emailVerifiedAt: new Date(), passwordHash: await hashPassword("secret123") } });
    }
    cookieA = await login("a@example.com", "secret123");
    cookieB = await login("b@example.com", "secret123");
  });
  afterAll(() => db.$disconnect());

  it("rejects unauthenticated API access and redirects protected pages", async () => {
    const api = await fetch(`${BASE}/api/progress`);
    expect(api.status).toBe(401);
    expect(api.headers.get("x-request-id")).toBeTruthy();
    const body = await api.json();
    expect(body.error).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(JSON.stringify(body)).not.toMatch(/stack|prisma|postgres/i);
    const page = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
    expect([303, 307, 308]).toContain(page.status);
    expect(page.headers.get("location")).toContain("/login");
  });

  it("returns a generic error for bad credentials", async () => {
    const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", ...ORIGIN }, body: JSON.stringify({ email: "a@example.com", password: "nope12345" }) });
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("INVALID_CREDENTIALS");
  });

  it("blocks cross-site mutations (Origin check)", async () => {
    const r = await fetch(`${BASE}/api/profile`, { method: "PATCH", headers: { Cookie: cookieA, "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ name: "Hacked" }) });
    expect(r.status).toBe(403);
    const none = await fetch(`${BASE}/api/profile`, { method: "PATCH", headers: { Cookie: cookieA, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Hacked" }) });
    expect(none.status).toBe(403);
  });

  it("serves practice without answer keys and scores on the server", async () => {
    const r = await fetch(`${BASE}/api/practice/read-in-daily-life/items`, { headers: { Cookie: cookieA } });
    expect(r.status).toBe(200);
    const set = await r.json();
    const text = JSON.stringify(set);
    expect(text).not.toMatch(/answerKey|answerIndex|"answer"/);
    const item = set.view.items[0];
    const sub = await fetch(`${BASE}/api/practice/items/${item.itemId}/submit`, {
      method: "POST",
      headers: { Cookie: cookieA, "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({ responses: [{ unitId: "q1", response: "B" }] }),
    });
    expect(sub.status).toBe(200);
    const res = await sub.json();
    expect(res.results.q1.correct).toBe(true);
    expect(res.results.q1.answer).toBe("B");
    const progress = await (await fetch(`${BASE}/api/progress`, { headers: { Cookie: cookieA } })).json();
    expect(progress.progress.questionsAttempted).toBe(1);
  });

  it("rejects invalid submissions", async () => {
    const set = await (await fetch(`${BASE}/api/practice/read-in-daily-life/items`, { headers: { Cookie: cookieA } })).json();
    const r = await fetch(`${BASE}/api/practice/items/${set.view.items[0].itemId}/submit`, {
      method: "POST",
      headers: { Cookie: cookieA, "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({ responses: [{ unitId: "q99", response: "B" }] }),
    });
    expect(r.status).toBe(400);
  });

  it("keeps each user's data private", async () => {
    // A generated item owned by user A.
    const a = await db.user.findUniqueOrThrow({ where: { emailNormalized: "a@example.com" } });
    const starter = await db.practiceItem.findFirstOrThrow({ where: { source: "starter", taskSlug: "write-email" } });
    const own = await db.practiceItem.create({
      data: {
        contentKey: "e2e:a:item",
        source: "generated",
        userId: a.id,
        taskSlug: starter.taskSlug,
        itemIndex: 0,
        difficulty: starter.difficulty,
        cefrLevel: starter.cefrLevel,
        topic: starter.topic,
        contentJson: starter.contentJson as object,
        answerKeyJson: starter.answerKeyJson as object,
        explanationJson: starter.explanationJson as object,
        provenanceJson: {},
        validationStatus: "valid",
      },
    });
    expect((await fetch(`${BASE}/api/practice/items/${own.id}`, { headers: { Cookie: cookieA } })).status).toBe(200);
    expect((await fetch(`${BASE}/api/practice/items/${own.id}`, { headers: { Cookie: cookieB } })).status).toBe(404);
    const sub = await fetch(`${BASE}/api/practice/items/${own.id}/submit`, {
      method: "POST",
      headers: { Cookie: cookieB, "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({ responses: [{ unitId: "w", response: { body: "Hello" } }] }),
    });
    expect(sub.status).toBe(404);
    expect((await fetch(`${BASE}/api/media/${own.id}/url`, { headers: { Cookie: cookieB } })).status).toBe(404);
  });

  it("health endpoint exposes no secrets", async () => {
    const text = await (await fetch(`${BASE}/api/health`)).text();
    expect(text).toMatch(/"database":true/);
    expect(text).not.toMatch(/postgres|amazonaws|sk_|Bearer|password/i);
  });

  it("logout revokes the session", async () => {
    const r = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: cookieB, "Content-Type": "application/json", ...ORIGIN }, body: "{}" });
    expect(r.status).toBe(200);
    expect((await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookieB } }).then((x) => x.json())).user).toBeNull();
    expect((await fetch(`${BASE}/api/progress`, { headers: { Cookie: cookieB } })).status).toBe(401);
  });
});
