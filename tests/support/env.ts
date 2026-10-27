// Loads .env.local and points the database at an isolated test schema, so tests
// never read or modify real application rows.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
if (url && !/[?&]schema=/.test(url)) process.env.DATABASE_URL = `${url}${url.includes("?") ? "&" : "?"}schema=lafaek_test`;
(process.env as Record<string, string>).NODE_ENV = "test";
// Tests must never call real paid services or write to the real bucket: Meta and the mailer are
// mocked per test, and storage / speech synthesis are switched off (asset jobs wait as blocked).
for (const k of ["S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "ELEVENLABS_API_KEY", "MODEL_API_KEY", "SMTP_PASSWORD"]) delete process.env[k];
// One item per task keeps integration tests fast against a remote database.
process.env.GENERATION_ITEMS_PER_TASK = "1";
process.env.AUTH_SECRET ||= "test-secret-only-used-in-tests-0123456789";
