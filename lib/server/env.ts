import "server-only";
import { z } from "zod";

// Server-side configuration. Values are validated lazily per feature so a missing
// optional integration (e.g. S3) fails only that feature, with a message that
// names the variable but never prints its value.

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const int = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const optional = z.string().trim().optional().transform((v) => (v ? v : undefined));
// Model ids pasted into hosting dashboards often carry stray spaces or quotes,
// which providers reject as an unknown model (Meta: 404 model_not_found).
const modelId = (fallback: string) =>
  z.string().trim().transform((v) => v.replace(/^["']+|["']+$/g, "").trim() || fallback).default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: optional,
  AUTH_SECRET: optional,
  OTP_TTL_MINUTES: int(10),
  OTP_MAX_ATTEMPTS: int(5),
  OTP_RESEND_COOLDOWN_SECONDS: int(60),
  SESSION_TTL_DAYS: int(30),
  SMTP_HOST: optional,
  SMTP_PORT: int(587),
  SMTP_SECURE: bool.default(false),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: optional,
  AWS_REGION: optional,
  AWS_ACCESS_KEY_ID: optional,
  AWS_SECRET_ACCESS_KEY: optional,
  S3_BUCKET: optional,
  MODEL_API_KEY: optional,
  META_API_BASE_URL: z.string().trim().url().default("https://api.meta.ai/v1"),
  META_TEXT_MODEL: modelId("muse-spark-1.3"),
  META_TEXT_FALLBACK_MODEL: modelId("muse-spark-1.2"),
  META_IMAGE_MODEL: modelId("muse-image-1.0"),
  META_TRANSCRIPTION_MODEL: modelId("muse-voice-transcribe-1.0"),
  ELEVENLABS_API_KEY: optional,
  ELEVENLABS_MODEL_ID: modelId("eleven_multilingual_v2"),
  ADMIN_CONTACT_EMAIL: optional,
  GENERATION_MAX_CONCURRENCY_PER_USER: int(1),
  /** Per-learner limit in the quick lane (audio, pictures, vocabulary, schedule, mock rating). */
  GENERATION_MAX_QUICK_CONCURRENCY_PER_USER: int(4),
  GENERATION_MAX_RETRIES: int(3),
  GENERATION_TIMEOUT_SECONDS: int(120),
  // Optional cap. Unset: each task type gets its full planned count (PRACTICE_TYPES referenceCount, 390 in total).
  GENERATION_ITEMS_PER_TASK: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  VOCABULARY_WORDS_PER_TASK: int(10),
  GENERATION_DAILY_USER_LIMIT: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  WORKER_TICK_SECRET: optional,
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new ConfigError(`Invalid configuration for: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export class ConfigError extends Error {
  readonly code = "CONFIGURATION_MISSING";
}

/** Returns the named variables, or throws ConfigError naming the missing ones (never their values). */
export function requireEnv<K extends keyof ServerEnv>(...keys: K[]): { [P in K]-?: NonNullable<ServerEnv[P]> } {
  const e = env();
  const missing = keys.filter((k) => e[k] === undefined || e[k] === "");
  if (missing.length) throw new ConfigError(`Missing configuration: ${missing.join(", ")}`);
  return e as unknown as { [P in K]-?: NonNullable<ServerEnv[P]> };
}

export const features = {
  database: () => Boolean(env().DATABASE_URL),
  email: () => Boolean(env().SMTP_HOST && env().SMTP_USER && env().SMTP_PASSWORD && env().SMTP_FROM),
  storage: () => Boolean(env().S3_BUCKET && env().AWS_REGION && env().AWS_ACCESS_KEY_ID && env().AWS_SECRET_ACCESS_KEY),
  metaText: () => Boolean(env().MODEL_API_KEY),
  tts: () => Boolean(env().ELEVENLABS_API_KEY),
};
