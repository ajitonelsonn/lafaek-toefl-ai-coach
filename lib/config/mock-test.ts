import type { PracticeSlug, SkillId } from "./practice-types";

/**
 * The short mock test: per section, which task types and how many questions from each.
 * Questions come from the learner's own AI-generated items first (unused in earlier mock tests),
 * then from the shared starter set. Complete the Words and Build a Sentence are practised on
 * their own pages and are not part of the mock test.
 */
export const MOCK_BLUEPRINT: Record<SkillId, { slug: PracticeSlug; items: number; unitsPerItem: number }[]> = {
  reading: [
    { slug: "read-in-daily-life", items: 1, unitsPerItem: 2 },
    { slug: "read-academic-passage", items: 1, unitsPerItem: 3 },
  ],
  listening: [
    { slug: "listen-choose-response", items: 2, unitsPerItem: 1 },
    { slug: "listen-conversation", items: 1, unitsPerItem: 2 },
    { slug: "listen-announcement", items: 1, unitsPerItem: 2 },
  ],
  writing: [{ slug: "write-email", items: 1, unitsPerItem: 1 }],
  speaking: [{ slug: "take-interview", items: 1, unitsPerItem: 2 }],
};

/** Minutes per section in the short mock test; each section has its own timer. */
export const MOCK_DEMO_MINUTES: Record<SkillId, number> = { reading: 8, listening: 7, writing: 7, speaking: 4 };

/** Planned full-length durations, shown for reference only (not official ETS timings). */
export const MOCK_FULL_MINUTES: Record<SkillId, number> = { reading: 35, listening: 36, writing: 32, speaking: 17 };

export const MOCK_SECTION_ORDER: SkillId[] = ["reading", "listening", "writing", "speaking"];

/** Questions per section in the short mock test. */
export const mockQuestionCount = (skill: SkillId) => MOCK_BLUEPRINT[skill].reduce((n, b) => n + b.items * b.unitsPerItem, 0);
