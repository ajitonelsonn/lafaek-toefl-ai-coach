import "server-only";
import { z, type ZodType } from "zod";
import { env, requireEnv } from "../env";
import { ProviderError, providerFetch } from "./http";

// Server-only adapter for the Meta Model API (https://dev.meta.ai/docs).
// Verified 2026-10-27: chat completions with json_schema structured output,
// muse-image-1.0 image generation, muse-voice-transcribe-1.0 speech-to-text.
// Meta offers NO text-to-speech model; speech synthesis lives in elevenlabs.ts.

const PROVIDER = "meta";

/** Allowlisted task types. Browser input never chooses models, endpoints or URLs. */
export type TextTask = `generate:${string}` | `verify:${string}` | "feedback:writing" | "feedback:speaking" | "score:writing" | "score:speaking";

export interface TextUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface TextResult<T> {
  data: T;
  usage: TextUsage;
  model: string;
  requestId: string | null;
}

function headers(extra?: Record<string, string>) {
  const { MODEL_API_KEY } = requireEnv("MODEL_API_KEY");
  return { Authorization: `Bearer ${MODEL_API_KEY}`, ...extra };
}

const base = () => env().META_API_BASE_URL.replace(/\/$/, "");
const timeoutMs = () => env().GENERATION_TIMEOUT_SECONDS * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Meta's catalog can intermittently omit a model and answer 404 model_not_found (observed
 * 2026-10-27: muse-spark-1.3 missing from 11 of 30 /models responses). Retry the configured
 * model a few times, then use the fallback model if one is given.
 */
async function withModel<T>(primary: string, fallback: string | undefined, call: (model: string) => Promise<T>): Promise<T> {
  const plan = [primary, primary, primary, ...(fallback && fallback !== primary ? [fallback] : [])];
  for (let i = 0; ; i++) {
    try {
      return await call(plan[i]);
    } catch (e) {
      if (!(e instanceof ProviderError && e.code === "model_not_found") || i === plan.length - 1) throw e;
      await sleep(500 * 2 ** i + Math.random() * 250);
    }
  }
}

/** Converts a Zod schema to Meta's strict JSON-schema subset. */
export function toStrictJsonSchema(schema: ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "throw" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

const chatResponse = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }), finish_reason: z.string().nullable().optional() })).min(1),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).partial().optional(),
});

/**
 * Generates structured JSON validated by `schema`. Throws ProviderError
 * (kind "invalid_output") when the model output fails validation.
 */
export async function generateText<T>(args: {
  task: TextTask;
  schema: ZodType<T>;
  system: string;
  user: string;
  temperature?: number;
  /** Longer limit for heavy calls (e.g. batched Build a Sentence); default GENERATION_TIMEOUT_SECONDS. */
  timeoutSeconds?: number;
}): Promise<TextResult<T>> {
  return withModel(env().META_TEXT_MODEL, env().META_TEXT_FALLBACK_MODEL, (model) => generateTextWith(model, args));
}

async function generateTextWith<T>(
  model: string,
  args: { task: TextTask; schema: ZodType<T>; system: string; user: string; temperature?: number; timeoutSeconds?: number },
): Promise<TextResult<T>> {
  const res = await providerFetch(
    `${base()}/chat/completions`,
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model,
        temperature: args.temperature ?? 0.7,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: args.task.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64), schema: toStrictJsonSchema(args.schema), strict: true },
        },
      }),
    },
    { provider: PROVIDER, timeoutMs: args.timeoutSeconds ? args.timeoutSeconds * 1000 : timeoutMs(), retries: 2 },
  );
  const requestId = res.headers.get("x-request-id");
  const body = chatResponse.safeParse(await res.json());
  if (!body.success) throw new ProviderError(PROVIDER, "invalid_output", "Unexpected response shape from Meta.", res.status, requestId ?? undefined);
  const content = body.data.choices[0].message.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new ProviderError(PROVIDER, "invalid_output", "Model output was not valid JSON.", res.status, requestId ?? undefined);
  }
  const validated = args.schema.safeParse(parsed);
  if (!validated.success) {
    const issues = validated.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    const err = new ProviderError(PROVIDER, "invalid_output", `Model output failed validation: ${issues}`, res.status, requestId ?? undefined);
    throw Object.assign(err, { raw: parsed });
  }
  return {
    data: validated.data,
    usage: { inputTokens: body.data.usage?.prompt_tokens ?? null, outputTokens: body.data.usage?.completion_tokens ?? null },
    model: body.data.model ?? model,
    requestId: requestId ?? body.data.id ?? null,
  };
}

const imageResponse = z.object({
  data: z.array(z.object({ b64_json: z.string().optional() })).min(1),
  output_format: z.string().optional(),
});

/** Generates one image and returns its bytes (b64_json response format). */
export async function generateImage(prompt: string, opts: { size?: string } = {}): Promise<{ bytes: Buffer; mimeType: string; model: string; requestId: string | null }> {
  const model = env().META_IMAGE_MODEL;
  const res = await withModel(model, undefined, (m) =>
    providerFetch(
      `${base()}/images/generations`,
      {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ model: m, prompt, n: 1, size: opts.size ?? "1536x1024", response_format: "b64_json" }),
      },
      { provider: PROVIDER, timeoutMs: Math.max(timeoutMs(), 120_000), retries: 2 },
    ),
  );
  const body = imageResponse.safeParse(await res.json());
  const b64 = body.success ? body.data.data[0].b64_json : undefined;
  if (!b64) throw new ProviderError(PROVIDER, "invalid_output", "Image response had no image data.", res.status);
  const fmt = (body.success && body.data.output_format) || "png";
  return { bytes: Buffer.from(b64, "base64"), mimeType: `image/${fmt === "jpg" ? "jpeg" : fmt}`, model, requestId: res.headers.get("x-request-id") };
}

const asrResponse = z.object({ transcript: z.string(), audioDurationMs: z.number().optional() });

/** Speech-to-text. Input must be WAV, mono, 16-bit PCM at 16 or 24 kHz (≤ 32 MB, ≤ 10 min). */
export async function transcribeAudio(wav: Buffer): Promise<{ transcript: string; audioDurationMs: number | null; model: string }> {
  const model = env().META_TRANSCRIPTION_MODEL;
  const res = await withModel(model, undefined, (m) => {
    const form = new FormData();
    form.append("request", new Blob([JSON.stringify({ model: m, mode: "PUSH_TO_TALK", audioEncoding: "WAV", languageBias: ["English"] })], { type: "application/json" }));
    form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "response.wav");
    return providerFetch(`${base()}/asr/transcribe`, { method: "POST", headers: headers({ Accept: "application/json" }), body: form }, { provider: PROVIDER, timeoutMs: 60_000, retries: 1 });
  });
  const body = asrResponse.safeParse(await res.json());
  if (!body.success) throw new ProviderError(PROVIDER, "invalid_output", "Unexpected transcription response.", res.status);
  return { transcript: body.data.transcript, audioDurationMs: body.data.audioDurationMs ?? null, model };
}

export function getCapabilities() {
  return { text: true, image: true, transcription: true, speechSynthesis: false } as const;
}

/** Checks the (unauthenticated) status endpoint and that the key can list models. */
export async function healthCheck(): Promise<{ status: boolean; modelsVisible: string[] }> {
  const status = await fetch(`${base()}/status`, { cache: "no-store" }).then((r) => r.ok).catch(() => false);
  const res = await providerFetch(`${base()}/models`, { headers: headers() }, { provider: PROVIDER, timeoutMs: 15_000, retries: 1 });
  const body = (await res.json()) as { data?: { id?: string }[] };
  return { status, modelsVisible: (body.data ?? []).map((m) => m.id ?? "").filter(Boolean) };
}
