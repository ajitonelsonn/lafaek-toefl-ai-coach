import "server-only";

// Structured JSON logs. Never pass secrets, OTPs, passwords, tokens, recordings
// or full learner content here; known-sensitive keys are redacted defensively.

const SENSITIVE = /pass|secret|token|otp|authorization|cookie|api[_-]?key|session|hash|email/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(redact(fields ?? {}) as object) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => write("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => write("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => write("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => write("error", msg, f),
};

/** Turns any thrown value into a short, non-sensitive summary. */
export function errorSummary(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/(sk_|Bearer\s+)[\w.-]+/gi, "$1[redacted]").slice(0, 300);
  return "Unknown error";
}
