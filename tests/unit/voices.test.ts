import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A key without "Voices: Read" (like production): listing voices returns 401, so the app uses its
// checked catalog plus labelled ELEVENLABS_VOICE_IDS entries.
beforeEach(() => {
  vi.resetModules();
  process.env.ELEVENLABS_API_KEY = "test-key";
  process.env.ELEVENLABS_VOICE_IDS = "IndianFemale01:indian:female, PlainVoice0001";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "missing_permissions" }), { status: 401 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_IDS;
});

const load = () => import("@/lib/server/providers/elevenlabs");

describe("voice picking", () => {
  it("matches each speaker's gender and the learner's accent", async () => {
    const { pickVoices } = await load();
    const [woman, man] = await pickVoices([{ gender: "female" }, { gender: "male" }], ["en-GB"], 3);
    expect(woman).toMatchObject({ gender: "female", accent: "british", locale: "en-GB" });
    expect(man).toMatchObject({ gender: "male", accent: "british", locale: "en-GB" });
    expect(woman.voiceId).not.toBe(man.voiceId);
  });

  it("uses a labelled voice from ELEVENLABS_VOICE_IDS for an accent the catalog lacks", async () => {
    const { pickVoices } = await load();
    const [v] = await pickVoices([{ gender: "female" }], ["en-IN"], 0);
    expect(v).toMatchObject({ voiceId: "IndianFemale01", locale: "en-IN" });
  });

  it("keeps the gender when the accent has no voice of that gender, and tries the learner's other accents first", async () => {
    const { pickVoices } = await load();
    const [v] = await pickVoices([{ gender: "female" }], ["en-AU", "en-GB"], 0); // no female Australian voice
    expect(v).toMatchObject({ gender: "female", locale: "en-GB" });
  });

  it("alternates genders when they are unknown, so two speakers sound different", async () => {
    const { pickVoices } = await load();
    const [a, b] = await pickVoices([{ gender: null }, { gender: null }], ["en-US"], 5);
    expect(a.gender).not.toBe(b.gender);
  });
});
