import "server-only";
import type { PracticeItem } from "@prisma/client";
import type { PracticeSlug } from "@/lib/config/practice-types";
import type { UnitResultDTO } from "@/lib/practice/dto";
import { runWritingChecks } from "./writing-checks";

// Deterministic, versioned scoring for objective tasks. Answer keys stay on the server
// and are revealed only in results after submission.
export const SCORING_VERSION = "objective-1";

type Json = Record<string, unknown>;

export function scoreUnit(slug: PracticeSlug, item: Pick<PracticeItem, "contentJson" | "answerKeyJson" | "explanationJson">, unitId: string, response: unknown): UnitResultDTO {
  const key = item.answerKeyJson as Json;
  const expl = item.explanationJson as Json;
  const content = item.contentJson as Json;
  switch (slug) {
    case "complete-the-words": {
      const expected = String(key[unitId] ?? "");
      const given = typeof response === "string" ? response.trim().toLowerCase() : "";
      return { correct: given === expected, answer: expected };
    }
    case "build-sentence": {
      const expected = key.s as string[];
      const given = Array.isArray(response) ? response.map(String) : [];
      const correct = given.length === expected.length && given.every((t, i) => t === expected[i]);
      return { correct, answer: expected, explanation: String(expl.explanation ?? ""), label: String(expl.answer ?? ""), parts: (expl.parts as UnitResultDTO["parts"]) ?? [] };
    }
    case "write-email":
    case "academic-discussion": {
      const body = typeof response === "object" && response && "body" in response ? String((response as { body: unknown }).body ?? "") : "";
      return {
        correct: null,
        checks: runWritingChecks(slug, {
          minWords: Number(content.minWords ?? 80),
          maxWords: (content.maxWords as number | null) ?? null,
          recipient: content.recipient as string | undefined,
          students: content.students as { name: string }[] | undefined,
        }, body),
        label: "Automatic checks — not AI scoring",
      };
    }
    case "listen-repeat":
    case "take-interview":
      return { correct: null };
    default: {
      const expected = String(key[unitId] ?? "");
      const given = typeof response === "string" ? response : "";
      const script = content.script as { speaker: { name: string }; text: string }[] | undefined;
      return {
        correct: given === expected,
        answer: expected,
        explanation: String(expl[unitId] ?? ""),
        ...(script ? { script: script.map((l) => ({ speaker: l.speaker.name, text: l.text })) } : {}),
      };
    }
  }
}

/** Validates the shape of a learner response before scoring. */
export function isValidResponse(slug: PracticeSlug, response: unknown): boolean {
  switch (slug) {
    case "complete-the-words":
      return typeof response === "string" && response.length <= 12;
    case "build-sentence":
      return Array.isArray(response) && response.length <= 12 && response.every((t) => typeof t === "string" && t.length <= 8);
    case "write-email":
    case "academic-discussion":
      return typeof response === "object" && response !== null && typeof (response as { body?: unknown }).body === "string" && (response as { body: string }).body.length <= 8000;
    case "listen-repeat":
    case "take-interview":
      return false;
    default:
      return typeof response === "string" && /^[A-D]$/.test(response);
  }
}
