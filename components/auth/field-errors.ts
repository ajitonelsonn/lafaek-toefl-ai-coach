import type { ZodError } from "zod";

export function fieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}
