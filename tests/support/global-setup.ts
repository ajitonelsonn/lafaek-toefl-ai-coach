import { execSync } from "node:child_process";
import { config } from "dotenv";

// Applies migrations to the isolated `lafaek_test` schema before integration tests.
export default function setup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const testUrl = `${url}${url.includes("?") ? "&" : "?"}schema=lafaek_test`;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: testUrl }, stdio: "ignore" });
}
