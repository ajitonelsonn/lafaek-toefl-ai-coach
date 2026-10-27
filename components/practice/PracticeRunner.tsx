"use client";

import type { PracticeType } from "@/lib/config/practice-types";
import type { PracticeContent } from "@/lib/services/types";
import { CompleteWordsPractice } from "./tasks/CompleteWordsPractice";
import { ReadingPractice } from "./tasks/ReadingPractice";
import { ChooseResponsePractice, ListeningPractice } from "./tasks/ListeningPractice";
import { BuildSentencePractice } from "./tasks/BuildSentencePractice";
import { WritingPractice } from "./tasks/WritingPractice";
import { SpeakingPractice } from "./tasks/SpeakingPractice";

/** Picks the interaction for a task type. Each of the 12 types maps to exactly one case. */
export function PracticeRunner({ type, content, sampleCount }: { type: PracticeType; content: PracticeContent; sampleCount: number }) {
  const props = { type, sampleCount };
  switch (content.kind) {
    case "complete-the-words":
      return <CompleteWordsPractice {...props} content={content} />;
    case "read-in-daily-life":
    case "read-academic-passage":
      return <ReadingPractice {...props} content={content} />;
    case "listen-choose-response":
      return <ChooseResponsePractice {...props} content={content} />;
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk":
      return <ListeningPractice {...props} content={content} />;
    case "build-sentence":
      return <BuildSentencePractice {...props} content={content} />;
    case "write-email":
    case "academic-discussion":
      return <WritingPractice {...props} content={content} />;
    case "listen-repeat":
    case "take-interview":
      return <SpeakingPractice {...props} content={content} />;
  }
}
