import "server-only";
import type { WritingCheckDTO } from "@/lib/practice/dto";

// Mechanical writing checks (length and structure). These are NOT AI scoring.
export const WRITING_CHECKS_VERSION = "writing-checks-1";

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export function runWritingChecks(
  kind: "write-email" | "academic-discussion",
  task: { minWords: number; maxWords: number | null; recipient?: string | null; students?: { name: string }[] },
  body: string,
): WritingCheckDTO[] {
  const words = countWords(body);
  const sentences = body.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim().split(/\s+/).length >= 3).length;
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const tooLong = task.maxWords !== null && words > task.maxWords;
  const checks: WritingCheckDTO[] = [
    {
      id: "length",
      label: "Length",
      passed: words >= task.minWords && !tooLong,
      detail: tooLong ? `You wrote ${words} words. Try to stay under ${task.maxWords}.` : words >= task.minWords ? `${words} words — good length.` : `${words} words. Aim for at least ${task.minWords}.`,
    },
    {
      id: "sentences",
      label: "Complete sentences",
      passed: sentences >= 4,
      detail: sentences >= 4 ? `${sentences} sentences found.` : `Only ${sentences} full sentence${sentences === 1 ? "" : "s"} found. Add more detail.`,
    },
  ];
  if (kind === "write-email") {
    checks.push(
      {
        id: "greeting",
        label: "Greeting",
        passed: /^\s*(dear|hi|hello|good (morning|afternoon|evening))\b/i.test(body),
        detail: /^\s*(dear|hi|hello)/i.test(body) ? "Your email starts with a greeting." : `Start with a greeting, for example “Hi ${task.recipient ?? "there"},”.`,
      },
      {
        id: "closing",
        label: "Closing",
        passed: /(regards|sincerely|best|thanks|thank you|cheers|see you)[^\n]{0,20}\n?\s*\S*\s*$/i.test(body.trim()),
        detail: "End with a polite closing such as “Best regards,” and your name.",
      },
      { id: "paragraphs", label: "Paragraphs", passed: paragraphs >= 2, detail: paragraphs >= 2 ? `${paragraphs} paragraphs.` : "Use short paragraphs (leave an empty line between them)." },
    );
  } else {
    const names = task.students?.map((s) => s.name) ?? [];
    const mentions = names.filter((n) => new RegExp(`\\b${n.replace(/[^\p{L}]/gu, "")}\\b`, "iu").test(body));
    checks.push(
      { id: "opinion", label: "Clear opinion", passed: /\b(i think|i believe|in my opinion|i agree|i disagree|in my view|i feel)\b/i.test(body), detail: "State your opinion clearly, for example “In my opinion, …”." },
      { id: "classmates", label: "Responds to classmates", passed: mentions.length > 0, detail: mentions.length ? `You mention ${mentions.join(" and ")}.` : `Refer to ${names.join(" or ")}'s idea and add your own.` },
      { id: "reasons", label: "Reasons or examples", passed: /\b(because|for example|for instance|such as|since|this is why)\b/i.test(body), detail: "Support your idea with “because…” or “for example…”." },
    );
  }
  return checks;
}
