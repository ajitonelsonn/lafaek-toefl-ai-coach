import type { SkillId } from "./practice-types";

/** Minutes per section in the short mock test. */
export const MOCK_DEMO_MINUTES: Record<SkillId, number> = { reading: 6, listening: 4, writing: 7, speaking: 2 };

/** Planned full-length durations, shown for reference only (not official ETS timings). */
export const MOCK_FULL_MINUTES: Record<SkillId, number> = { reading: 35, listening: 36, writing: 32, speaking: 17 };

export const MOCK_SECTION_ORDER: SkillId[] = ["reading", "listening", "writing", "speaking"];
