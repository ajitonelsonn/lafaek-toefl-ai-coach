// Single source of truth for the 12 TOEFL 2026 practice task types.
// Cards, navigation, routes, the mock test and study plans all derive from this file.

export type SkillId = "reading" | "listening" | "writing" | "speaking";

export interface Skill {
  id: SkillId;
  title: string;
  description: string;
}

export const SKILLS: readonly Skill[] = [
  { id: "reading", title: "Reading", description: "Build vocabulary, understand passages, and improve comprehension." },
  { id: "listening", title: "Listening", description: "Train with conversations, announcements, and academic talks." },
  { id: "writing", title: "Writing", description: "Practise sentence building, email writing, and academic discussion." },
  { id: "speaking", title: "Speaking", description: "Improve pronunciation, fluency, and confidence." },
] as const;

export type PracticeSlug =
  | "complete-the-words"
  | "read-in-daily-life"
  | "read-academic-passage"
  | "listen-choose-response"
  | "listen-conversation"
  | "listen-announcement"
  | "listen-academic-talk"
  | "build-sentence"
  | "write-email"
  | "academic-discussion"
  | "listen-repeat"
  | "take-interview";

export interface PracticeType {
  slug: PracticeSlug;
  title: string;
  /** Short label used in compact lists. */
  shortTitle: string;
  skill: SkillId;
  /** Questions AI generates per study plan for this type (owner defaults, 133 in total). GENERATION_ITEMS_PER_TASK can cap it. */
  referenceCount: number;
  description: string;
  /** Subtitle shown in the practice page header. */
  instruction: string;
  /** Suggested time for the bundled sample set, in seconds. */
  timeLimitSeconds: number;
  /** Rough minutes per question, used for study-plan and recommendation estimates. */
  minutesPerItem: number;
}

export const PRACTICE_TYPES: readonly PracticeType[] = [
  {
    slug: "complete-the-words",
    title: "Complete the Words",
    shortTitle: "Complete the Words",
    skill: "reading",
    referenceCount: 5,
    description: "Fill in the missing letters in the paragraph.",
    instruction: "Fill in the missing letters in the paragraph.",
    timeLimitSeconds: 3 * 60,
    minutesPerItem: 3,
  },
  {
    slug: "read-in-daily-life",
    title: "Read in Daily Life",
    shortTitle: "Daily Life",
    skill: "reading",
    referenceCount: 16,
    description: "Read notices, emails, and real-world texts.",
    instruction: "Read the text and answer the questions.",
    timeLimitSeconds: 6 * 60,
    minutesPerItem: 1,
  },
  {
    slug: "read-academic-passage",
    title: "Read an Academic Passage",
    shortTitle: "Academic Passage",
    skill: "reading",
    referenceCount: 5,
    description: "Read academic texts and answer questions.",
    instruction: "Read the passage and answer the questions.",
    timeLimitSeconds: 10 * 60,
    minutesPerItem: 2,
  },
  {
    slug: "listen-choose-response",
    title: "Listen and Choose a Response",
    shortTitle: "Choose a Response",
    skill: "listening",
    referenceCount: 50,
    description: "Listen and choose the best response.",
    instruction: "Listen to the audio and choose the best response.",
    timeLimitSeconds: 3 * 60,
    minutesPerItem: 0.5,
  },
  {
    slug: "listen-conversation",
    title: "Listen to a Conversation",
    shortTitle: "Conversation",
    skill: "listening",
    referenceCount: 5,
    description: "Listen to a conversation and answer questions.",
    instruction: "Listen to the conversation and answer the questions.",
    timeLimitSeconds: 6 * 60,
    minutesPerItem: 1.5,
  },
  {
    slug: "listen-announcement",
    title: "Listen to an Announcement",
    shortTitle: "Announcement",
    skill: "listening",
    referenceCount: 5,
    description: "Listen to a short announcement.",
    instruction: "Listen to the announcement and answer the questions.",
    timeLimitSeconds: 5 * 60,
    minutesPerItem: 1.5,
  },
  {
    slug: "listen-academic-talk",
    title: "Listen to an Academic Talk",
    shortTitle: "Academic Talk",
    skill: "listening",
    referenceCount: 5,
    description: "Listen to an academic talk and answer questions.",
    instruction: "Listen to the talk and answer the questions.",
    timeLimitSeconds: 8 * 60,
    minutesPerItem: 2,
  },
  {
    slug: "build-sentence",
    title: "Build a Sentence",
    shortTitle: "Build a Sentence",
    skill: "writing",
    referenceCount: 25,
    description: "Arrange the words to create a correct sentence.",
    instruction: "Arrange the words to make a correct and natural sentence.",
    timeLimitSeconds: 6 * 60,
    minutesPerItem: 1,
  },
  {
    slug: "write-email",
    title: "Write an Email",
    shortTitle: "Write an Email",
    skill: "writing",
    referenceCount: 5,
    description: "Write a complete and effective email.",
    instruction: "Read the task and write an email. Use complete sentences.",
    timeLimitSeconds: 7 * 60,
    minutesPerItem: 7,
  },
  {
    slug: "academic-discussion",
    title: "Write for an Academic Discussion",
    shortTitle: "Academic Discussion",
    skill: "writing",
    referenceCount: 5,
    description: "Write a response to an academic prompt.",
    instruction: "Read the discussion and write a response to the professor's question.",
    timeLimitSeconds: 10 * 60,
    minutesPerItem: 10,
  },
  {
    slug: "listen-repeat",
    title: "Listen and Repeat",
    shortTitle: "Listen and Repeat",
    skill: "speaking",
    referenceCount: 5,
    description: "Listen carefully and repeat what you hear.",
    instruction: "Listen to the audio and repeat what you hear.",
    timeLimitSeconds: 4 * 60,
    minutesPerItem: 0.5,
  },
  {
    slug: "take-interview",
    title: "Take an Interview",
    shortTitle: "Take an Interview",
    skill: "speaking",
    referenceCount: 2,
    description: "Answer four questions on a variety of topics.",
    instruction: "Listen to the interviewer's questions and respond naturally.",
    timeLimitSeconds: 5 * 60,
    minutesPerItem: 1,
  },
] as const;

export const PRACTICE_SLUGS = PRACTICE_TYPES.map((t) => t.slug);

export function getPracticeType(slug: string): PracticeType | undefined {
  return PRACTICE_TYPES.find((t) => t.slug === slug);
}

export function getSkill(id: SkillId): Skill {
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

export function practiceTypesForSkill(id: SkillId): PracticeType[] {
  return PRACTICE_TYPES.filter((t) => t.skill === id);
}

export function referenceTotalForSkill(id: SkillId): number {
  return practiceTypesForSkill(id).reduce((sum, t) => sum + t.referenceCount, 0);
}

export function practiceHref(slug: PracticeSlug): string {
  return `/practice/${slug}`;
}
