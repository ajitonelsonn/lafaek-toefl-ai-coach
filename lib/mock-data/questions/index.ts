import type { PracticeSlug } from "@/lib/config/practice-types";
import type { PracticeContent } from "@/lib/services/types";
import { completeTheWords, readAcademicPassage, readInDailyLife } from "./reading";
import { listenAcademicTalk, listenAnnouncement, listenChooseResponse, listenConversation } from "./listening";
import { academicDiscussion, buildSentence, listenRepeat, takeInterview, writeEmail } from "./writing-speaking";

export const SAMPLE_SETS: Record<PracticeSlug, PracticeContent> = {
  "complete-the-words": completeTheWords,
  "read-in-daily-life": readInDailyLife,
  "read-academic-passage": readAcademicPassage,
  "listen-choose-response": listenChooseResponse,
  "listen-conversation": listenConversation,
  "listen-announcement": listenAnnouncement,
  "listen-academic-talk": listenAcademicTalk,
  "build-sentence": buildSentence,
  "write-email": writeEmail,
  "academic-discussion": academicDiscussion,
  "listen-repeat": listenRepeat,
  "take-interview": takeInterview,
};

/** IDs of the gradable/practisable units in a sample set (what progress counts). */
export function sampleUnitIds(content: PracticeContent): string[] {
  switch (content.kind) {
    case "read-in-daily-life":
    case "read-academic-passage":
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk":
      return content.items.flatMap((i) => i.questions.map((q) => q.id));
    case "listen-choose-response":
      return content.items.map((i) => i.question.id);
    default:
      return content.items.map((i) => i.id);
  }
}

export function sampleCount(slug: PracticeSlug): number {
  return sampleUnitIds(SAMPLE_SETS[slug]).length;
}
