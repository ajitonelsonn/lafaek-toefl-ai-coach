import "server-only";
import { createHash } from "node:crypto";

// Generated questions mostly put the correct option first. Every four-option question is therefore
// shown in its own shuffled order, fixed per question (hash of item and question id), so a reload,
// practice and the mock test all show the same order. Stored content keeps the original order;
// views, scoring and explanations go through these helpers.

const LETTERS = ["A", "B", "C", "D"];

/** Position p on screen shows original option order[p]. */
export function choiceOrder(itemId: string, unitId: string): number[] {
  const h = createHash("sha256").update(`choice-order:${itemId}:${unitId}`).digest();
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = h[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** The letter shown on screen for an original option letter. */
export function shownLetter(itemId: string, unitId: string, original: string): string {
  const i = LETTERS.indexOf(original);
  return i < 0 ? original : LETTERS[choiceOrder(itemId, unitId).indexOf(i)];
}

/** Options in their shown order, relabelled A–D. Anything that is not four options A–D is left as it is. */
export function shuffleOptions(itemId: string, unitId: string, options: { id: string; text: string }[]): { id: string; text: string }[] {
  if (options.length !== 4 || options.some((o, i) => o.id !== LETTERS[i])) return options;
  return choiceOrder(itemId, unitId).map((orig, p) => ({ id: LETTERS[p], text: options[orig].text }));
}

/** Rewrites letter references in an explanation ("option B", "(B)") to the shown letters. */
export function relabelExplanation(itemId: string, unitId: string, text: string): string {
  return text
    .replace(/\b(options?|answers?|choices?|responses?|repl(?:y|ies))\s+([A-D])\b/gi, (_m, word: string, l: string) => `${word} ${shownLetter(itemId, unitId, l.toUpperCase())}`)
    .replace(/\(([A-D])\)/g, (_m, l: string) => `(${shownLetter(itemId, unitId, l)})`);
}
