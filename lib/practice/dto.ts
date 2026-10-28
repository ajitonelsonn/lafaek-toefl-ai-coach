// Client-safe practice view types. These never contain answer keys.
// Unit keys used by the UI are `${itemId}:${unitId}`.

import type { PracticeSlug } from "@/lib/config/practice-types";
import type { DailyLifeDocument } from "@/lib/services/types";

export type ItemSourceDTO = "starter" | "generated";

export interface AudioDTO {
  /** Ready audio files, one per script segment, played in order (via /api/media/:id/url). Empty until all segments exist. */
  assetIds: string[];
  provider: string | null;
  /** Script for the browser-voice fallback; only sent when no audio file is ready. */
  script: { speaker: string; text: string }[] | null;
  estimatedSeconds: number;
  /** Where to ask again for files that were not ready when the page loaded (GET /api/practice/items/:itemId/audio?role=). */
  source?: { itemId: string; role: string };
}

export interface ChoiceQuestionDTO {
  unitId: string;
  prompt: string;
  options: { id: string; text: string }[];
}

interface Base {
  itemId: string;
  source: ItemSourceDTO;
}

export type CtwSegment = { type: "text"; text: string } | { type: "blank"; unitId: string; prefix: string; length: number };

export type PracticeView =
  | { kind: "complete-the-words"; items: (Base & { title: string; segments: CtwSegment[] })[] }
  | {
      kind: "read-in-daily-life" | "read-academic-passage";
      items: (Base & { title: string; document?: DailyLifeDocument; paragraphs?: string[]; questions: ChoiceQuestionDTO[] })[];
    }
  | { kind: "listen-choose-response"; items: (Base & { audio: AudioDTO; question: ChoiceQuestionDTO })[] }
  | {
      kind: "listen-conversation" | "listen-announcement" | "listen-academic-talk";
      items: (Base & { title: string; scene: "conversation" | "announcement" | "lecture"; imageAssetId: string | null; audio: AudioDTO; questions: ChoiceQuestionDTO[] })[];
    }
  | {
      kind: "build-sentence";
      items: (Base & { unitId: string; context: string; prefix: string | null; suffix: string | null; tokens: { id: string; text: string }[] })[];
    }
  | {
      kind: "write-email" | "academic-discussion";
      items: (Base & {
        unitId: string;
        scenario: string;
        bullets: string[];
        recipient: string | null;
        subject: string | null;
        minWords: number;
        maxWords: number | null;
        professor: { name: string; prompt: string } | null;
        students: { name: string; text: string }[];
        checklist: string[];
        tips: string[];
        imageAssetId: string | null;
        illustration: "emailHiking" | null;
        draft: { to?: string; subject?: string; body: string } | null;
      })[];
    }
  | {
      kind: "listen-repeat";
      items: (Base & { situation: string; imageAssetId: string | null; illustration: "officePrinter" | null; sentences: { unitId: string; audio: AudioDTO; responseSeconds: number }[] })[];
    }
  | {
      kind: "take-interview";
      items: (Base & { scenario: string; imageAssetId: string | null; questions: { unitId: string; audio: AudioDTO; responseSeconds: number }[] })[];
    };

export interface WritingCheckDTO {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface UnitResultDTO {
  /** true/false for objective units; null when not auto-scored. */
  correct: boolean | null;
  /** Revealed only after submission. Shape depends on the task. */
  answer?: unknown;
  explanation?: string;
  checks?: WritingCheckDTO[];
  transcript?: string;
  similarity?: number;
  /** Transcript/script revealed after submission. */
  script?: { speaker: string; text: string }[];
  label?: string;
  /** Build a Sentence: grammatical parts of the correct sentence. */
  parts?: { role: "opener" | "connector" | "subject" | "verb" | "object" | "rest"; text: string }[];
}

export interface SubmitResponseDTO {
  results: Record<string, UnitResultDTO>;
}

/** The learner's saved answers since their last "Start over", keyed `${itemId}:${unitId}`. */
export interface PracticeProgressDTO {
  answers: Record<string, unknown>;
  results: Record<string, UnitResultDTO>;
}

export interface PracticeSetDTO {
  slug: PracticeSlug;
  view: PracticeView;
  progress: PracticeProgressDTO;
  /** Total ready units across items (for progress). */
  unitCount: number;
  generatedCount: number;
  starterCount: number;
}
