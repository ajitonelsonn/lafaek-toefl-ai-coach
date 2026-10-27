import "server-only";
import { db } from "../db";
import { requireAuthPage } from "./session";
import type { SessionUser, UserSettings } from "@/components/session/SessionProvider";

/** Loads the signed-in user and preferences for the authenticated shell (redirects to /login otherwise). */
export async function loadShellSession(): Promise<{ user: SessionUser; settings: UserSettings }> {
  const { user } = await requireAuthPage();
  const p = await db.userPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  return {
    user: { id: user.id, name: user.displayName, email: user.emailNormalized, role: user.role, createdAt: user.createdAt.toISOString() },
    settings: { theme: p.theme as UserSettings["theme"], sound: p.soundEnabled, reminders: p.remindersEnabled, recordingConsent: p.recordingConsent },
  };
}
