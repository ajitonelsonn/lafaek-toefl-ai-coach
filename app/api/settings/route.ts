import { z } from "zod";
import { db } from "@/lib/server/db";
import { json, parseBody, route } from "@/lib/server/http";
import { requireAuth } from "@/lib/server/auth/session";

const settings = z.object({
  theme: z.enum(["light", "dark", "system"]),
  sound: z.boolean(),
  reminders: z.boolean(),
  recordingConsent: z.boolean(),
});

const toDTO = (p: { theme: string; soundEnabled: boolean; remindersEnabled: boolean; recordingConsent: boolean }) => ({
  theme: p.theme as "light" | "dark" | "system",
  sound: p.soundEnabled,
  reminders: p.remindersEnabled,
  recordingConsent: p.recordingConsent,
});

export const GET = route(async () => {
  const { user } = await requireAuth();
  const p = await db.userPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  return json({ settings: toDTO(p) });
});

export const PATCH = route(async (req) => {
  const { user } = await requireAuth();
  const s = await parseBody(req, settings);
  const data = { theme: s.theme, soundEnabled: s.sound, remindersEnabled: s.reminders, recordingConsent: s.recordingConsent };
  const p = await db.userPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return json({ settings: toDTO(p) });
});
