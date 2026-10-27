// Simple rule-based checks for writing practice. These are NOT AI scoring;
// they only look at length and structure so learners get some guidance offline.
import type { WritingTask } from "@/lib/services/types";
import { countWords } from "./format";

export interface WritingCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runWritingChecks(task: WritingTask, kind: "write-email" | "academic-discussion", body: string): WritingCheck[] {
  const words = countWords(body);
  const sentences = body.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim().split(/\s+/).length >= 3).length;
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const checks: WritingCheck[] = [
    {
      id: "length",
      label: "Length",
      passed: words >= task.minWords && (!task.maxWords || words <= task.maxWords),
      detail:
        task.maxWords && words > task.maxWords
          ? `You wrote ${words} words. Try to stay under ${task.maxWords}.`
          : words >= task.minWords
            ? `${words} words — good length.`
            : `${words} words. Aim for at least ${task.minWords}.`,
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
      {
        id: "paragraphs",
        label: "Paragraphs",
        passed: paragraphs >= 2,
        detail: paragraphs >= 2 ? `${paragraphs} paragraphs.` : "Use short paragraphs (leave an empty line between them).",
      },
    );
  } else {
    const names = task.students?.map((st) => st.name) ?? [];
    const mentions = names.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(body));
    checks.push(
      {
        id: "opinion",
        label: "Clear opinion",
        passed: /\b(i think|i believe|in my opinion|i agree|i disagree|in my view|i feel)\b/i.test(body),
        detail: "State your opinion clearly, for example “In my opinion, …”.",
      },
      {
        id: "classmates",
        label: "Responds to classmates",
        passed: mentions.length > 0,
        detail: mentions.length ? `You mention ${mentions.join(" and ")}.` : `Refer to ${names.join(" or ")}'s idea and add your own.`,
      },
      {
        id: "reasons",
        label: "Reasons or examples",
        passed: /\b(because|for example|for instance|such as|since|this is why)\b/i.test(body),
        detail: "Support your idea with “because…” or “for example…”.",
      },
    );
  }
  return checks;
}
