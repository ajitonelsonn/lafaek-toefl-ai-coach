"use client";

import type { PracticeType } from "@/lib/config/practice-types";
import type { PracticeSetDTO } from "@/lib/practice/dto";
import type { GenerationTaskDTO } from "@/lib/practice/generation-dto";
import { EmptyState } from "@/components/ui/States";
import { LinkButton } from "@/components/ui/Button";
import { ContentStatusCard } from "./ContentStatusCard";
import { CompleteWordsPractice } from "./tasks/CompleteWordsPractice";
import { ReadingPractice } from "./tasks/ReadingPractice";
import { ChooseResponsePractice, ListeningPractice } from "./tasks/ListeningPractice";
import { BuildSentencePractice } from "./tasks/BuildSentencePractice";
import { WritingPractice } from "./tasks/WritingPractice";
import { SpeakingPractice } from "./tasks/SpeakingPractice";

/** Picks the interaction for a task type. Each of the 12 types maps to exactly one case. */
export function PracticeRunner({ type, set, task }: { type: PracticeType; set: PracticeSetDTO; task: GenerationTaskDTO | null }) {
  const sidebarExtra = <ContentStatusCard type={type} starterCount={set.starterCount} generatedCount={set.generatedCount} task={task} />;
  const view = set.view;
  if (!view.items.length) {
    return (
      <EmptyState
        title="No questions are ready for this practice type yet"
        description="Personalised questions appear here as soon as they are generated."
        action={<LinkButton href="/practice">Back to Practice Center</LinkButton>}
      />
    );
  }
  const props = { type, sidebarExtra };
  switch (view.kind) {
    case "complete-the-words":
      return <CompleteWordsPractice {...props} view={view} />;
    case "read-in-daily-life":
    case "read-academic-passage":
      return <ReadingPractice {...props} view={view} />;
    case "listen-choose-response":
      return <ChooseResponsePractice {...props} view={view} />;
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk":
      return <ListeningPractice {...props} view={view} />;
    case "build-sentence":
      return <BuildSentencePractice {...props} view={view} />;
    case "write-email":
    case "academic-discussion":
      return <WritingPractice {...props} view={view} />;
    case "listen-repeat":
    case "take-interview":
      return <SpeakingPractice {...props} view={view} />;
  }
}
