import type { PracticeSlug, SkillId } from "./practice-types";

/**
 * The mock test: all 12 task types, as a number of items per task type. Every question of each
 * item is used, so the number of questions follows the generation settings (e.g. a Read in Daily
 * Life item has 2–3 questions). `about` is the usual number of questions per item, for display only.
 * Items come from the learner's own AI-generated questions first (unused in earlier mock tests),
 * then from the shared starter set.
 */
export const MOCK_BLUEPRINT: Record<SkillId, { slug: PracticeSlug; items: number; about: number }[]> = {
  reading: [
    { slug: "complete-the-words", items: 1, about: 10 },
    { slug: "read-in-daily-life", items: 3, about: 3 },
    { slug: "read-academic-passage", items: 2, about: 5 },
  ],
  listening: [
    { slug: "listen-choose-response", items: 5, about: 1 },
    { slug: "listen-conversation", items: 2, about: 2 },
    { slug: "listen-announcement", items: 2, about: 2 },
    { slug: "listen-academic-talk", items: 2, about: 4 },
  ],
  writing: [
    { slug: "build-sentence", items: 10, about: 1 },
    { slug: "write-email", items: 1, about: 1 },
    { slug: "academic-discussion", items: 1, about: 1 },
  ],
  speaking: [
    { slug: "listen-repeat", items: 1, about: 7 },
    { slug: "take-interview", items: 1, about: 4 },
  ],
};

/** Minutes per section, close to the TOEFL iBT 2026 timings; each section has its own timer. */
export const MOCK_DEMO_MINUTES: Record<SkillId, number> = { reading: 30, listening: 29, writing: 23, speaking: 8 };

/**
 * Task types with their own timer inside their section, like the real Writing section: 6 minutes for
 * the Build a Sentence questions, 7 for the email and 10 for the discussion post (23 in total).
 */
export const MOCK_PART_MINUTES: Partial<Record<PracticeSlug, number>> = { "build-sentence": 6, "write-email": 7, "academic-discussion": 10 };

/** Full TOEFL iBT 2026 section lengths, shown for reference only (not official ETS timings). */
export const MOCK_FULL_MINUTES: Record<SkillId, number> = { reading: 30, listening: 29, writing: 23, speaking: 8 };

export const MOCK_SECTION_ORDER: SkillId[] = ["reading", "listening", "writing", "speaking"];

/** About how many questions a section has (the real number follows the items chosen). */
export const mockQuestionCount = (skill: SkillId) => MOCK_BLUEPRINT[skill].reduce((n, b) => n + b.items * b.about, 0);
