// SAMPLE CONTENT — a short demo mock test assembled from the sample practice sets.
import type { SkillId } from "@/lib/config/practice-types";
import type { ChoiceQuestion, DailyLifeDocument, MediaRef, WritingTask } from "@/lib/services/types";
import { readAcademicPassage, readInDailyLife } from "./questions/reading";
import { listenAnnouncement, listenChooseResponse } from "./questions/listening";
import { takeInterview, writeEmail } from "./questions/writing-speaking";

export type MockItem =
  | { id: string; skill: SkillId; kind: "choice"; taskTitle: string; question: ChoiceQuestion; document?: DailyLifeDocument; passage?: { title: string; paragraphs: string[] }; audio?: MediaRef }
  | { id: string; skill: SkillId; kind: "writing"; taskTitle: string; task: WritingTask }
  | { id: string; skill: SkillId; kind: "speaking"; taskTitle: string; audio: MediaRef; responseSeconds: number };

const email = readInDailyLife.items[0];
const passage = readAcademicPassage.items[0];
const announcement = listenAnnouncement.items[0];

export const MOCK_ITEMS: MockItem[] = [
  { id: "m-r1", skill: "reading", kind: "choice", taskTitle: "Read in Daily Life", question: email.questions[0], document: email.document },
  { id: "m-r2", skill: "reading", kind: "choice", taskTitle: "Read in Daily Life", question: email.questions[2], document: email.document },
  { id: "m-r3", skill: "reading", kind: "choice", taskTitle: "Read an Academic Passage", question: passage.questions[0], passage: { title: passage.title, paragraphs: passage.paragraphs ?? [] } },
  { id: "m-r4", skill: "reading", kind: "choice", taskTitle: "Read an Academic Passage", question: passage.questions[3], passage: { title: passage.title, paragraphs: passage.paragraphs ?? [] } },
  { id: "m-l1", skill: "listening", kind: "choice", taskTitle: "Listen and Choose a Response", question: listenChooseResponse.items[1].question, audio: listenChooseResponse.items[1].audio },
  { id: "m-l2", skill: "listening", kind: "choice", taskTitle: "Listen and Choose a Response", question: listenChooseResponse.items[4].question, audio: listenChooseResponse.items[4].audio },
  { id: "m-l3", skill: "listening", kind: "choice", taskTitle: "Listen to an Announcement", question: announcement.questions[2], audio: announcement.audio },
  { id: "m-w1", skill: "writing", kind: "writing", taskTitle: "Write an Email", task: writeEmail.items[1] },
  { id: "m-s1", skill: "speaking", kind: "speaking", taskTitle: "Take an Interview", audio: takeInterview.items[1].audio, responseSeconds: 45 },
];

export const MOCK_SECTION_ORDER: SkillId[] = ["reading", "listening", "writing", "speaking"];

/** Minutes per section in the short demo session. */
export const MOCK_DEMO_MINUTES: Record<SkillId, number> = { reading: 6, listening: 4, writing: 7, speaking: 2 };

/** Planned full-length durations shown for reference only (design brief). */
export const MOCK_FULL_MINUTES: Record<SkillId, number> = { reading: 35, listening: 36, writing: 32, speaking: 17 };

export function itemsForSections(sections: SkillId[]): MockItem[] {
  return MOCK_SECTION_ORDER.filter((s) => sections.includes(s)).flatMap((s) => MOCK_ITEMS.filter((i) => i.skill === s));
}
