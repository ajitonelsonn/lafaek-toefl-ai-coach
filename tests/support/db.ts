import { db } from "@/lib/server/db";

/** Empties all tables in the isolated test schema. Refuses to run against any other schema. */
export async function resetTestDb() {
  if (!/schema=lafaek_test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Refusing to reset a non-test database");
  await db.$executeRawUnsafe(`TRUNCATE users, auth_otps, sessions, study_plans, generation_batches, generation_jobs, practice_items, media_assets,
    practice_attempts, usage_events, user_preferences, vocabulary_progress, practice_drafts, mock_test_results, admin_audit_events, rate_limits CASCADE`);
}

export async function createUser(email: string) {
  return db.user.create({ data: { emailNormalized: email, displayName: email.split("@")[0], status: "active", emailVerifiedAt: new Date() } });
}
