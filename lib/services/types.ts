// Shared content and domain types (study plans, documents, vocabulary).
// Server implementations live in lib/server; browser DTOs in lib/practice.

import type { PracticeSlug, SkillId } from "@/lib/config/practice-types";

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export interface ChoiceOption {
  id: string; // "A" | "B" | ...
  text: string;
}

export interface ChoiceQuestion {
  id: string;
  prompt: string;
  options: ChoiceOption[];
  answerId: string;
  explanation: string;
}

/** Reference to playable media. `url` is null until real audio exists (e.g. a signed S3 URL). */
export interface MediaRef {
  id: string;
  kind: "audio" | "image";
  url: string | null;
  /** Script read by the browser's speech voice while no audio file exists. */
  transcript: string;
  /** Speaker turns for conversations; used for the transcript view and voice switching. */
  turns?: { speaker: string; text: string }[];
  estimatedSeconds: number;
}

export interface CompleteWordsSet {
  kind: "complete-the-words";
  items: { id: string; title: string; text: string }[]; // text uses "visible[missing]" markers
}

export type DailyLifeDocument =
  | { type: "email"; from: string; to: string; subject: string; body: string[]; signOff: string }
  | { type: "notice"; heading: string; body: string[]; footer?: string }
  | { type: "chat"; title: string; messages: { sender: string; text: string; time: string }[] };

export interface ReadingSet {
  kind: "read-in-daily-life" | "read-academic-passage";
  items: {
    id: string;
    title: string;
    document?: DailyLifeDocument;
    paragraphs?: string[];
    questions: ChoiceQuestion[];
  }[];
}

export interface ChooseResponseSet {
  kind: "listen-choose-response";
  items: { id: string; audio: MediaRef; question: ChoiceQuestion }[];
}

export interface ListeningSet {
  kind: "listen-conversation" | "listen-announcement" | "listen-academic-talk";
  items: {
    id: string;
    title: string;
    scene: "conversation" | "announcement" | "lecture";
    audio: MediaRef;
    questions: ChoiceQuestion[];
  }[];
}

export interface SentencePart {
  role: "opener" | "connector" | "subject" | "verb" | "object" | "rest";
  text: string;
}

export interface BuildSentenceSet {
  kind: "build-sentence";
  items: {
    id: string;
    context: string;
    /** Correct token order. Shown shuffled. */
    tokens: string[];
    prefix?: string;
    suffix?: string;
    answer: string;
    parts: SentencePart[];
    explanation: string;
  }[];
}

export interface WritingTask {
  id: string;
  scenario: string;
  /** Optional illustration key from lib/config/assets ILLUSTRATIONS. */
  illustration?: "emailHiking";
  bullets: string[];
  recipient?: string;
  subject?: string;
  minWords: number;
  maxWords?: number;
  professor?: { name: string; prompt: string };
  students?: { name: string; text: string }[];
  checklist: string[];
  tips: string[];
}

export interface WritingSet {
  kind: "write-email" | "academic-discussion";
  items: WritingTask[];
}

export interface ListenRepeatSet {
  kind: "listen-repeat";
  situation: string;
  items: { id: string; audio: MediaRef; responseSeconds: number }[];
}

export interface InterviewSet {
  kind: "take-interview";
  scenario: string;
  items: { id: string; audio: MediaRef; responseSeconds: number }[];
}

export type PracticeContent =
  | CompleteWordsSet
  | ReadingSet
  | ChooseResponseSet
  | ListeningSet
  | BuildSentenceSet
  | WritingSet
  | ListenRepeatSet
  | InterviewSet;

export interface QuestionSet {
  slug: PracticeSlug;
  /** "sample" = bundled demo content; "generated" = future personalised content. */
  source: "sample" | "generated";
  content: PracticeContent;
}


// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  name: string;
  email: string;
  createdAt: string;
}


// ---------------------------------------------------------------------------
// Study plans & generation jobs
// ---------------------------------------------------------------------------

export type EnglishLevel = "beginner" | "intermediate" | "upper-intermediate" | "advanced";
export type StudyEmphasis = "balanced" | "weak-areas" | "test-strategy" | "vocabulary";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface StudyPlanInput {
  level: EnglishLevel;
  targetScore: number;
  testDate: string | null;
  dailyMinutes: number;
  studyDays: Weekday[];
  weakAreas: SkillId[];
  emphasis: StudyEmphasis;
}

export interface StudyPlanPhase {
  title: string;
  weeks: string;
  focus: string;
  tasks: { slug: PracticeSlug | null; label: string }[];
}

export interface StudyPlan {
  id: string;
  input: StudyPlanInput;
  createdAt: string;
  totalWeeks: number;
  phases: StudyPlanPhase[];
  dailyTasks: { id: string; label: string; href: string; minutes: number }[];
}


export type GenerationState = "not_started" | "queued" | "generating" | "ready" | "failed";

export interface GenerationJob {
  id: string;
  slug: PracticeSlug;
  state: GenerationState;
  progress: number; // 0-100
  itemsReady: number;
  itemsTotal: number;
  updatedAt: string;
  error?: string;
}


// ---------------------------------------------------------------------------
// Media (future: private S3 objects served through short-lived signed URLs)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export type UsageRange = "7d" | "30d" | "all";

export type UsageMetricId =
  | "ai-tokens"
  | "image-generations"
  | "audio-minutes"
  | "ai-requests"
  | "questions-generated"
  | "practice-sessions"
  | "study-time";

export interface UsageMetric {
  id: UsageMetricId;
  label: string;
  value: number;
  unit?: string;
  /** Only present when a limit is configured. */
  limit: number | null;
  description: string;
}

export interface UsageSummary {
  range: UsageRange;
  metrics: UsageMetric[];
  daily: { date: string; requests: number }[];
  isDemo: boolean;
}


// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type VocabCategory = "academic" | "campus" | "science" | "business" | "environment" | "health" | "technology";

export interface VocabWord {
  id: string;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  meaning: string;
  example: string;
  category: VocabCategory;
  related?: { word: string; partOfSpeech: string; meaning: string }[];
  /** Practice type whose questions the word was taken from. */
  taskSlug?: string;
}
