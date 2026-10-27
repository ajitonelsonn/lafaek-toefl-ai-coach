// Fails if any secret value appears in client bundles (.next/static) or git-tracked files.
// Prints variable NAMES only, never values. Run after `npm run build`: node scripts/check-secrets.mjs
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SECRET_KEYS = ["DATABASE_URL", "AUTH_SECRET", "SMTP_PASSWORD", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "MODEL_API_KEY", "ELEVENLABS_API_KEY", "WORKER_TICK_SECRET"];

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}
const secrets = SECRET_KEYS.map((k) => [k, env[k]]).filter(([, v]) => v && v.length >= 8);
// For URLs, also check the password part on its own.
const db = env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1];
if (db) secrets.push(["DATABASE_URL (password)", db]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const targets = [];
if (existsSync(".next/static")) targets.push(...walk(".next/static").map((f) => ["client bundle", f]));
for (const f of execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean)) if (existsSync(f) && statSync(f).isFile()) targets.push(["git-tracked", f]);

let leaks = 0;
for (const [kind, file] of targets) {
  const text = readFileSync(file, "latin1");
  for (const [name, value] of secrets) {
    if (text.includes(value)) {
      console.log(`LEAK ${name} found in ${kind}: ${file}`);
      leaks++;
    }
  }
}
console.log(`${leaks ? "FAIL" : "PASS"}: scanned ${targets.length} files for ${secrets.length} secret values; ${leaks} leak(s).`);
process.exit(leaks ? 1 : 0);
