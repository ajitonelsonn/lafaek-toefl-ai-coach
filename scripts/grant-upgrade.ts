// Adds Boost Packs to an account after the learner has paid (payment is arranged by email).
//   npm run upgrade:grant -- learner@example.com            (1 pack: +1 study plan, +2 mock tests)
//   npm run upgrade:grant -- learner@example.com 2 "paid by bank transfer"
// In production (Render Shell): npm run upgrade:grant:prod -- learner@example.com
import { grantBoostPacks } from "../lib/server/credits";
import { db } from "../lib/server/db";

async function main() {
  const [email, packsArg, note] = process.argv.slice(2);
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run upgrade:grant -- <email> [packs=1] [note]");
    process.exit(1);
  }
  const r = await grantBoostPacks({ email, packs: Number(packsArg ?? 1), note, grantedBy: "cli" });
  console.log(`Added ${r.added.planCredits} study plan(s) and ${r.added.mockCredits} mock test(s) to ${r.email}.`);
  console.log(`Now: ${r.credits.planCredits} study plan(s), ${r.credits.mockCredits} mock test(s) left.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
