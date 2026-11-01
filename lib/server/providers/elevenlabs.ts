import "server-only";
import { z } from "zod";
import { env, requireEnv } from "../env";
import { ProviderError, providerFetch } from "./http";

// Text-to-speech via ElevenLabs (owner-approved; Meta has no TTS model).
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
// ElevenLabs returns no usage headers, so character counts are estimates.

const PROVIDER = "elevenlabs";
const BASE = "https://api.elevenlabs.io/v1";

const voicesResponse = z.object({
  voices: z.array(
    z.object({
      voice_id: z.string(),
      name: z.string(),
      category: z.string().optional(),
      labels: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

export interface Voice {
  voiceId: string;
  name: string;
  accent: string | null;
  gender: string | null;
}

let voiceCache: { at: number; voices: Voice[] } | null = null;

/**
 * ElevenLabs' standard voices with their accent and gender, each checked with a real call on
 * 2026-11-01. Used when the key cannot list voices, so speakers still get a voice of the right
 * gender and accent. There are no standard Indian, African or female Australian voices: add some
 * from the Voice Library to the account and list them in ELEVENLABS_VOICE_IDS (see below).
 */
export const VOICE_CATALOG: Voice[] = [
  { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", accent: "american", gender: "female" },
  { voiceId: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", accent: "american", gender: "female" },
  { voiceId: "cgSgspJ2msm6clMCkdW9", name: "Jessica", accent: "american", gender: "female" },
  { voiceId: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", accent: "american", gender: "female" },
  { voiceId: "9BWtsMINqrJLrRacOk9x", name: "Aria", accent: "american", gender: "female" },
  { voiceId: "nPczCjzI2devNBz1zQrb", name: "Brian", accent: "american", gender: "male" },
  { voiceId: "iP95p4xoKVk53GoZ742B", name: "Chris", accent: "american", gender: "male" },
  { voiceId: "cjVigY5qzO86Huf0OWal", name: "Eric", accent: "american", gender: "male" },
  { voiceId: "bIHbv24MWmeRgasZH58o", name: "Will", accent: "american", gender: "male" },
  { voiceId: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", accent: "american", gender: "male" },
  { voiceId: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", accent: "american", gender: "male" },
  { voiceId: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", accent: "british", gender: "female" },
  { voiceId: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", accent: "british", gender: "female" },
  { voiceId: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "british", gender: "male" },
  { voiceId: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", accent: "british", gender: "male" },
  { voiceId: "IKne3meq5aSn9XLyUdCD", name: "Charlie", accent: "australian", gender: "male" },
];

/**
 * Extra voices from ELEVENLABS_VOICE_IDS, e.g. "id1,id2:indian:female,id3:south african:male". An
 * entry with an accent and gender is matched like the catalog; a bare id has unknown labels.
 */
function configuredVoices(): Voice[] {
  return (process.env.ELEVENLABS_VOICE_IDS ?? "")
    .split(",")
    .map((s) => s.trim().split(":").map((p) => p.trim()))
    .filter(([id]) => /^[A-Za-z0-9]{8,40}$/.test(id ?? ""))
    .map(([voiceId, accent, gender], i) => ({ voiceId, name: `Voice ${i + 1}`, accent: accent ? accent.toLowerCase() : null, gender: gender ? gender.toLowerCase() : null }));
}

/** The catalog plus configured voices, without duplicates (configured labels win). */
function fallbackVoices(): Voice[] {
  const configured = configuredVoices();
  return [...configured, ...VOICE_CATALOG.filter((v) => !configured.some((c) => c.voiceId === v.voiceId))];
}

export async function listVoices(): Promise<Voice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60_000) return voiceCache.voices;
  const { ELEVENLABS_API_KEY } = requireEnv("ELEVENLABS_API_KEY");
  let res: Response;
  try {
    res = await providerFetch(`${BASE}/voices`, { headers: { "xi-api-key": ELEVENLABS_API_KEY } }, { provider: PROVIDER, timeoutMs: 20_000, retries: 2 });
  } catch (e) {
    // Keys scoped to text-to-speech cannot list voices: use the checked catalog and configured voices.
    if (e instanceof ProviderError && e.kind === "auth") {
      voiceCache = { at: Date.now(), voices: fallbackVoices() };
      return voiceCache.voices;
    }
    throw e;
  }
  const body = voicesResponse.safeParse(await res.json());
  if (!body.success) throw new ProviderError(PROVIDER, "invalid_output", "Unexpected voices response.");
  const voices = body.data.voices.map((v) => ({ voiceId: v.voice_id, name: v.name, accent: v.labels?.accent?.toLowerCase() ?? null, gender: v.labels?.gender?.toLowerCase() ?? null }));
  voiceCache = { at: Date.now(), voices: voices.length ? voices : fallbackVoices() };
  return voiceCache.voices;
}

const ACCENT_WORDS: Record<string, string[]> = {
  "en-US": ["american"],
  "en-GB": ["british", "english"],
  "en-AU": ["australian"],
  "en-IN": ["indian"],
  "en-ZA": ["south african", "african", "nigerian", "kenyan"],
};
const localeOf = (accent: string | null) => Object.entries(ACCENT_WORDS).find(([, words]) => accent && words.some((w) => accent.includes(w)))?.[0] ?? "unspecified";

/**
 * Picks distinct voices for the speakers of one item. Each speaker's gender (when known) is matched
 * first, so the voice fits the person in the picture; then one of the learner's accents, rotating by
 * item so a plan hears all of them. A missing accent falls back to another chosen accent before any
 * other voice. Speakers without a known gender alternate genders so they sound clearly different.
 */
export async function pickVoices(speakers: { gender?: string | null }[], accents: string[], seed: number): Promise<(Voice & { locale: string })[]> {
  const voices = await listVoices();
  if (!voices.length) throw new ProviderError(PROVIDER, "not_configured", "No ElevenLabs voices are available on this account.");
  const wanted = accents.length ? accents : ["en-US"];
  const out: (Voice & { locale: string })[] = [];
  const fits = (v: Voice, locale: string) => !!v.accent && (ACCENT_WORDS[locale] ?? []).some((w) => v.accent!.includes(w));
  speakers.forEach((speaker, i) => {
    const unused = voices.filter((v) => !out.some((o) => o.voiceId === v.voiceId));
    const pool = unused.length ? unused : voices;
    const gender = speaker.gender ?? (out[out.length - 1]?.gender === "female" ? "male" : out.length ? "female" : null);
    const byGender = gender ? pool.filter((v) => v.gender === gender) : pool;
    // The learner's accents, starting from this item's turn.
    const order = wanted.map((_, k) => wanted[(seed + i + k) % wanted.length]);
    let choices: Voice[] = [];
    for (const locale of order) {
      choices = byGender.filter((v) => fits(v, locale));
      if (choices.length) break;
    }
    if (!choices.length) choices = byGender.length ? byGender : pool;
    const v = choices[(seed * 7 + i * 3) % choices.length];
    out.push({ ...v, locale: localeOf(v.accent) });
  });
  return out;
}

export async function synthesizeSpeech(text: string, voiceId: string): Promise<{ bytes: Buffer; mimeType: string; model: string; characters: number }> {
  const { ELEVENLABS_API_KEY } = requireEnv("ELEVENLABS_API_KEY");
  if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId)) throw new ProviderError(PROVIDER, "bad_request", "Invalid voice id.");
  const model = env().ELEVENLABS_MODEL_ID;
  const res = await providerFetch(
    `${BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model }),
    },
    { provider: PROVIDER, timeoutMs: 60_000, retries: 2 },
  );
  const bytes = Buffer.from(await res.arrayBuffer());
  // MP3 files start with an ID3 tag or an MPEG frame sync (0xFFE…).
  const looksMp3 = bytes.length > 200 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
  if (!looksMp3) throw new ProviderError(PROVIDER, "invalid_output", "Speech response was not MP3 audio.");
  return { bytes, mimeType: "audio/mpeg", model, characters: text.length };
}
