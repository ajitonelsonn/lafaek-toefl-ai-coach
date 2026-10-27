// Loads .env.local and points the database at an isolated test schema, so tests
// never read or modify real application rows.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
if (url && !/[?&]schema=/.test(url)) process.env.DATABASE_URL = `${url}${url.includes("?") ? "&" : "?"}schema=lafaek_test`;
(process.env as Record<string, string>).NODE_ENV = "test";
// One item per task keeps integration tests fast against a remote database.
process.env.GENERATION_ITEMS_PER_TASK = "1";
process.env.AUTH_SECRET ||= "test-secret-only-used-in-tests-0123456789";
