import "server-only";

// Complete the Words as on the TOEFL iBT 2026: the first sentence is complete; from the second
// sentence on, the second half of every other word is removed until there are 10 blanks; the rest
// of the paragraph is complete again. Making the blanks in code (instead of asking the model to
// mark them) keeps every passage consistent with the real task.

/** Letters kept visible: half for words up to 4 letters (ea·ch, h·as), a little less for longer ones (sp·read). */
export const keptLetters = (length: number) => (length <= 4 ? Math.floor(length / 2) : Math.floor((length - 1) / 2));

/**
 * Marks C-test blanks in a plain paragraph as `kept[missing]` (the stored format). A passage that
 * already has brackets is returned unchanged. Names (capitalised mid-sentence), words with
 * apostrophes or digits, one-letter words and words that would lose more than 6 letters are skipped;
 * a skipped word does not break the every-other-word rhythm.
 */
export function addCTestBlanks(passage: string, count = 10): string {
  if (passage.includes("[")) return passage;
  const first = passage.match(/^[\s\S]*?[.!?]["”')]?(?=\s+["“(]?[A-Z])/);
  if (!first) return passage;
  const head = first[0];
  const parts = passage.slice(head.length).split(/(\s+)/);
  let blanks = 0;
  let blankNext = true;
  let sentenceStart = true;
  for (let i = 0; i < parts.length && blanks < count; i++) {
    const token = parts[i];
    if (!token || /^\s+$/.test(token)) continue;
    const m = token.match(/^(["“(]?)([A-Za-z]+)([.,;:!?"”')]*)$/);
    const startsSentence = sentenceStart;
    sentenceStart = /[.!?]["”')]*$/.test(token);
    if (!blankNext) {
      blankNext = true;
      continue;
    }
    const word = m?.[2] ?? "";
    const isName = /^[A-Z]/.test(word) && !startsSentence;
    const missing = word.length - keptLetters(word.length);
    if (!m || word.length < 2 || isName || missing > 6) continue;
    parts[i] = `${m[1]}${word.slice(0, keptLetters(word.length))}[${word.slice(keptLetters(word.length))}]${m[3]}`;
    blanks++;
    blankNext = false;
  }
  return head + parts.join("");
}
