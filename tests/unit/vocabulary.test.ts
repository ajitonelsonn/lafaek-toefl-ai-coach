import { describe, expect, it } from "vitest";
import { appearsIn, corpusOf, normaliseWord } from "@/lib/server/generation/vocabulary";

describe("vocabulary from the learner's questions", () => {
  it("collects visible text and skips image prompts and ids", () => {
    const text = corpusOf([{ passage: "Photosynthesis needs light.", imagePrompt: "a secret scene", options: [{ id: "a", text: "Plants analyzed data" }] }]);
    expect(text).toContain("Photosynthesis needs light.");
    expect(text).toContain("Plants analyzed data");
    expect(text).not.toContain("secret scene");
  });

  it("accepts words found in the text (including simple stems) and rejects others", () => {
    const lower = "students analyzed the evidence before the deadline.";
    expect(appearsIn("evidence", lower)).toBe(true);
    expect(appearsIn("Analyze", lower)).toBe(true);
    expect(appearsIn("hypothesis", lower)).toBe(false);
  });

  it("normalises words for de-duplication", () => {
    expect(normaliseWord("  Carbon   Dioxide ")).toBe("carbon dioxide");
  });
});
