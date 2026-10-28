import { describe, expect, it } from "vitest";
import { PRACTICE_TYPES, type PracticeSlug } from "@/lib/config/practice-types";
import { validateGenerated } from "@/lib/server/content/schemas";
import { buildView, unitIdsOf } from "@/lib/server/content/view";
import { scoreUnit, isValidResponse } from "@/lib/server/content/scoring";
import { starterEntries } from "@/prisma/starter/convert";
import { bySlug, fakeItems } from "../support/items";

describe("task catalog", () => {
  it("has exactly the 12 TOEFL 2026 task slugs, with only two speaking tasks", () => {
    expect(PRACTICE_TYPES.map((t) => t.slug)).toEqual([
      "complete-the-words", "read-in-daily-life", "read-academic-passage", "listen-choose-response", "listen-conversation",
      "listen-announcement", "listen-academic-talk", "build-sentence", "write-email", "academic-discussion", "listen-repeat", "take-interview",
    ]);
    expect(PRACTICE_TYPES.filter((t) => t.skill === "speaking").map((t) => t.slug)).toEqual(["listen-repeat", "take-interview"]);
  });
  it("every starter item passes the generation validators", () => {
    const entries = starterEntries();
    expect(new Set(entries.map((e) => e.slug)).size).toBe(12);
    for (const e of entries) expect(validateGenerated(e.slug, e.output)).toMatchObject({ ok: true });
  });
});

describe("validation rejects malformed AI output", () => {
  it("rejects missing fields and wrong counts", () => {
    expect(validateGenerated("read-in-daily-life", { title: "x" }).ok).toBe(false);
    const lr = starterEntries().find((e) => e.slug === "listen-repeat")!.output as { sentences: string[] };
    expect(validateGenerated("listen-repeat", { ...lr, sentences: lr.sentences.slice(0, 6) }).ok).toBe(false);
  });
  it("rejects duplicate options and unknown speakers", () => {
    const conv = starterEntries().find((e) => e.slug === "listen-conversation")!.output as Record<string, unknown> & { script: { speakerId: string; text: string }[]; questions: { options: string[] }[] };
    expect(validateGenerated("listen-conversation", { ...conv, script: [...conv.script, { speakerId: "S3", text: "Hello there." }] }).ok).toBe(false);
    const q = conv.questions.map((x, i) => (i === 0 ? { ...x, options: ["a", "a", "b", "c"] } : x));
    expect(validateGenerated("listen-conversation", { ...conv, questions: q }).ok).toBe(false);
  });
  it("rejects Complete the Words passages with the wrong number of blanks", () => {
    const ctw = starterEntries().find((e) => e.slug === "complete-the-words")!.output as { passage: string };
    expect(validateGenerated("complete-the-words", { ...ctw, passage: ctw.passage.replace(/\[([^\]]+)\]/g, "$1") }).ok).toBe(false);
  });
  it("rejects non-unique Build a Sentence word groups", () => {
    const bs = starterEntries().find((e) => e.slug === "build-sentence")!.output as { tokens: string[] };
    expect(validateGenerated("build-sentence", { ...bs, tokens: [bs.tokens[0], ...bs.tokens] }).ok).toBe(false);
  });
});

describe("answer keys never reach the browser before submission", () => {
  it.each(PRACTICE_TYPES.map((t) => t.slug))("%s view has no answers", (slug) => {
    // With real audio attached, no audio script is sent either (Listen and Repeat's
    // expected sentences are its scripts; they are only sent as a browser-voice fallback).
    const items = bySlug(slug as PracticeSlug).map((i) => ({
      ...i,
      media: ["main", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "i1", "i2", "i3", "i4"].flatMap((role) => {
        const script = (i.contentJson as { script?: unknown[] }).script;
        const lines = role === "main" ? (Array.isArray(script) ? script.length : 0) : 1;
        return Array.from({ length: lines }, (_, n) => ({ id: `${role}-${n}`, kind: "audio", status: "ready", role: `audio:${role}:${n}`, provider: "elevenlabs" }) as never);
      }),
    }));
    const json = JSON.stringify(buildView(slug as PracticeSlug, items));
    expect(json).not.toMatch(/answerKey|answerIndex|answerId|"answer"/);
    for (const item of items) {
      const key = item.answerKeyJson as Record<string, unknown>;
      for (const v of Object.values(key)) {
        // Choice letters appear as option ids; check only non-trivial answers.
        if (typeof v === "string" && v.length > 3) expect(json).not.toContain(`"${v}"`);
      }
    }
  });
  it("withholds scripts once real audio exists", () => {
    const item = bySlug("listen-choose-response")[0];
    const withAudio = { ...item, media: [{ id: "a1", kind: "audio", status: "ready", role: "audio:main:0", provider: "elevenlabs" } as never] };
    const v = buildView("listen-choose-response", [withAudio]) as Extract<ReturnType<typeof buildView>, { kind: "listen-choose-response" }>;
    expect(v.items[0].audio.assetIds).toEqual(["a1"]);
    expect(v.items[0].audio.script).toBeNull();
  });
  it("uses the newest file when a line's audio was stored twice (not the browser voice)", () => {
    const item = bySlug("listen-choose-response")[0];
    const media = [
      { id: "old", kind: "audio", status: "ready", role: "audio:main:0", provider: "elevenlabs", createdAt: new Date("2026-10-28T10:00:00Z") },
      { id: "new", kind: "audio", status: "ready", role: "audio:main:0", provider: "elevenlabs", createdAt: new Date("2026-10-28T10:05:00Z") },
    ] as never[];
    const v = buildView("listen-choose-response", [{ ...item, media }]) as Extract<ReturnType<typeof buildView>, { kind: "listen-choose-response" }>;
    expect(v.items[0].audio.assetIds).toEqual(["new"]);
    expect(v.items[0].audio.script).toBeNull();
  });
});

describe("objective scoring", () => {
  const all = fakeItems();
  it("multiple choice: correct and incorrect", () => {
    const item = all.find((i) => i.taskSlug === "read-in-daily-life")!;
    const key = (item.answerKeyJson as Record<string, string>).q1;
    expect(scoreUnit("read-in-daily-life", item, "q1", key)).toMatchObject({ correct: true, answer: key });
    const wrong = ["A", "B", "C", "D"].find((l) => l !== key)!;
    expect(scoreUnit("read-in-daily-life", item, "q1", wrong).correct).toBe(false);
  });
  it("listening results reveal the script only after submission", () => {
    const item = all.find((i) => i.taskSlug === "listen-conversation")!;
    expect(scoreUnit("listen-conversation", item, "q1", "A").script?.length).toBeGreaterThan(1);
  });
  it("Complete the Words is case-insensitive per blank", () => {
    const item = all.find((i) => i.taskSlug === "complete-the-words")!;
    expect(scoreUnit("complete-the-words", item, "b0", "SING").correct).toBe(true);
    expect(scoreUnit("complete-the-words", item, "b0", "sung").correct).toBe(false);
  });
  it("Build a Sentence checks the exact order and returns the explanation", () => {
    const item = all.find((i) => i.taskSlug === "build-sentence")!;
    const order = (item.answerKeyJson as { s: string[] }).s;
    const ok = scoreUnit("build-sentence", item, "s", order);
    expect(ok.correct).toBe(true);
    expect(ok.label).toBe("Do you know if they announced the dates for next year's event?");
    expect(ok.parts?.length).toBeGreaterThan(2);
    expect(scoreUnit("build-sentence", item, "s", [...order].reverse()).correct).toBe(false);
  });
  it("writing is not auto-scored and is labelled as checks", () => {
    const item = all.find((i) => i.taskSlug === "write-email")!;
    const r = scoreUnit("write-email", item, "w", { body: "Hi Chris,\n\nShort." });
    expect(r.correct).toBeNull();
    expect(r.label).toMatch(/not AI scoring/i);
    expect(r.checks?.find((c) => c.id === "greeting")?.passed).toBe(true);
  });
  it("rejects malformed responses", () => {
    expect(isValidResponse("read-in-daily-life", "E")).toBe(false);
    expect(isValidResponse("build-sentence", "t1")).toBe(false);
    expect(isValidResponse("write-email", { body: "x".repeat(9000) })).toBe(false);
  });
  it("every item exposes stable unit ids", () => {
    for (const i of all) expect(unitIdsOf(i.taskSlug as PracticeSlug, i).length).toBeGreaterThan(0);
  });
});
