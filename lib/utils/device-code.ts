/**
 * Pairing codes for signing in another device (a Meta Quest, a phone): 8 characters, shown as
 * "K7QM-3XPA". Letters and digits that look alike (I L 1, O 0) are left out, so a code read off one
 * screen and typed on a headset keyboard is hard to get wrong. Shared by the server and the browser.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** Upper-cases and strips spaces and dashes. Returns null unless the result is a well-formed code. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** "K7QM3XPA" → "K7QM-3XPA". Also formats a partly typed code while the learner types. */
export function formatCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/** Pages a code sign-in may return to (exact matches only, so it can never send anyone off-site). */
export const DEVICE_RETURN_TO = ["/vr"] as const;

export function safeReturnTo(next: string | null | undefined): string | undefined {
  return next && (DEVICE_RETURN_TO as readonly string[]).includes(next) ? next : undefined;
}
