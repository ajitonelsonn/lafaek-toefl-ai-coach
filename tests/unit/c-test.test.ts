import { describe, expect, it } from "vitest";
import { addCTestBlanks, keptLetters } from "@/lib/server/content/c-test";
import { validateGenerated } from "@/lib/server/content/schemas";

// Original paragraph (not from any test book).
const PARAGRAPH =
  "Rivers shape the land around them in many ways. Over time, flowing water slowly wears away rock and carries small pieces of soil far downstream. When the river finally reaches flat ground near the sea, it slows down and drops this material, which builds wide areas of rich farmland. Because of this, many early towns grew up beside rivers, where people could grow food and travel easily by boat.";

describe("Complete the Words blanks (C-test)", () => {
  it("keeps half of short words and a little less than half of longer ones", () => {
    expect([2, 3, 4, 5, 6, 7, 8].map(keptLetters)).toEqual([1, 1, 2, 2, 2, 3, 3]);
  });

  it("leaves the first sentence whole and blanks every other word from the second sentence, 10 times", () => {
    const marked = addCTestBlanks(PARAGRAPH);
    expect(marked.startsWith("Rivers shape the land around them in many ways. ")).toBe(true);
    const blanks = [...marked.matchAll(/(\S*?)\[([^\]]+)\]/g)].map((m) => `${m[1]}[${m[2]}]`);
    expect(blanks).toEqual(["Ov[er]", "flo[wing]", "sl[owly]", "aw[ay]", "a[nd]", "sm[all]", "o[f]", "f[ar]", "Wh[en]", "ri[ver]"]);
    // After the 10th blank the text is complete again, and removing the brackets gives the original.
    expect(marked.endsWith("travel easily by boat.")).toBe(true);
    expect(marked.replace(/\[([^\]]+)\]/g, "$1")).toBe(PARAGRAPH);
  });

  it("skips names and contractions without breaking the rhythm, and leaves marked passages alone", () => {
    const marked = addCTestBlanks("Teams need clear goals to succeed. Last year Maria's team won because the members shared every task and kept their promises to each other.");
    expect(marked).not.toContain("Ma[");
    expect(marked).toContain("La[st]");
    expect(addCTestBlanks("Already marked. Th[is] one.")).toBe("Already marked. Th[is] one.");
  });

  it("is applied to generated plain paragraphs, which then need exactly 10 blanks", () => {
    const meta = { topic: "rivers and farming", cefrLevel: "B2", difficulty: "medium" };
    expect(validateGenerated("complete-the-words", { ...meta, title: "Rivers and Farming", passage: PARAGRAPH }).ok).toBe(true);
    const short = validateGenerated("complete-the-words", { ...meta, title: "Rivers", passage: `${PARAGRAPH.split(". ").slice(0, 2).join(". ")}. And then some more words follow here today.` });
    expect(short.ok).toBe(false);
  });
});
