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
 * Voice IDs to use when the API key cannot list voices (keys can be scoped to
 * text-to-speech only). Configure with ELEVENLABS_VOICE_IDS="id1,id2,…".
 * Accents of these voices are not verified, so they are recorded as unknown.
 */
function configuredVoices(): Voice[] {
  const ids = (process.env.ELEVENLABS_VOICE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9]{8,40}$/.test(s));
  return ids.map((voiceId, i) => ({ voiceId, name: `Voice ${i + 1}`, accent: null, gender: null }));
}

export async function listVoices(): Promise<Voice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60_000) return voiceCache.voices;
  const { ELEVENLABS_API_KEY } = requireEnv("ELEVENLABS_API_KEY");
  let res: Response;
  try {
    res = await providerFetch(`${BASE}/voices`, { headers: { "xi-api-key": ELEVENLABS_API_KEY } }, { provider: PROVIDER, timeoutMs: 20_000, retries: 2 });
  } catch (e) {
    const fallback = configuredVoices();
    if (e instanceof ProviderError && e.kind === "auth" && fallback.length) {
      voiceCache = { at: Date.now(), voices: fallback };
      return fallback;
    }
    if (e instanceof ProviderError && e.kind === "auth") {
      throw new ProviderError(PROVIDER, "not_configured", "ElevenLabs key cannot list voices: grant 'Voices: Read' or set ELEVENLABS_VOICE_IDS.");
    }
    throw e;
  }
  const body = voicesResponse.safeParse(await res.json());
  if (!body.success) throw new ProviderError(PROVIDER, "invalid_output", "Unexpected voices response.");
  const voices = body.data.voices.map((v) => ({ voiceId: v.voice_id, name: v.name, accent: v.labels?.accent?.toLowerCase() ?? null, gender: v.labels?.gender?.toLowerCase() ?? null }));
  voiceCache = { at: Date.now(), voices };
  return voices;
}

const ACCENT_WORDS: Record<string, string[]> = {
  "en-US": ["american"],
  "en-GB": ["british", "english"],
  "en-AU": ["australian"],
  "en-IN": ["indian"],
};

/**
 * Picks distinct voices for the speakers of one item, preferring the learner's
 * accent choices. Only voices that exist on the account are used.
 */
export async function pickVoices(speakerCount: number, accents: string[], seed: number): Promise<(Voice & { locale: string })[]> {
  const voices = await listVoices();
  if (!voices.length) throw new ProviderError(PROVIDER, "not_configured", "No ElevenLabs voices are available on this account.");
  const wanted = accents.length ? accents : ["en-US"];
  const out: (Voice & { locale: string })[] = [];
  for (let i = 0; i < speakerCount; i++) {
    const locale = wanted[(seed + i) % wanted.length];
    const words = ACCENT_WORDS[locale] ?? [];
    const pool = voices.filter((v) => v.accent && words.some((w) => v.accent!.includes(w)) && !out.some((o) => o.voiceId === v.voiceId));
    const fallback = voices.filter((v) => !out.some((o) => o.voiceId === v.voiceId));
    const choices = pool.length ? pool : fallback.length ? fallback : voices;
    // Alternate genders where possible so two speakers sound clearly different.
    const prevGender = out[out.length - 1]?.gender;
    const preferred = choices.filter((v) => !prevGender || v.gender !== prevGender);
    const list = preferred.length ? preferred : choices;
    const v = list[(seed * 7 + i * 3) % list.length];
    out.push({ ...v, locale: pool.includes(v) ? locale : v.accent ? locale : "unspecified" });
  }
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
