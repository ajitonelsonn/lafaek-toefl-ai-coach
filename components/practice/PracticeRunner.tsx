"use client";

import { useCallback, useState } from "react";
import { PRACTICE_TYPES, practiceHref, type PracticeType } from "@/lib/config/practice-types";
import type { PracticeProgressDTO, PracticeSetDTO } from "@/lib/practice/dto";
import type { GenerationTaskDTO } from "@/lib/practice/generation-dto";
import { api, errorMessage } from "@/lib/client/api";
import { EmptyState } from "@/components/ui/States";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Icon3D } from "@/components/ui/Icon3D";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { ContentStatusCard } from "./ContentStatusCard";
import { PracticeProgressProvider } from "./PracticeProgressContext";
import { CompleteWordsPractice } from "./tasks/CompleteWordsPractice";
import { ReadingPractice } from "./tasks/ReadingPractice";
import { ChooseResponsePractice, ListeningPractice } from "./tasks/ListeningPractice";
import { BuildSentencePractice } from "./tasks/BuildSentencePractice";
import { WritingPractice } from "./tasks/WritingPractice";
import { SpeakingPractice } from "./tasks/SpeakingPractice";

const EMPTY: PracticeProgressDTO = { answers: {}, results: {} };

/**
 * Picks the interaction for a task type (each of the 12 types maps to exactly one case), restores
 * the learner's saved answers so they continue where they stopped, and offers "Start over".
 */
export function PracticeRunner({ type, set, task }: { type: PracticeType; set: PracticeSetDTO; task: GenerationTaskDTO | null }) {
  const toast = useToast();
  const [progress, setProgress] = useState(set.progress ?? EMPTY);
  const [round, setRound] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const startOver = useCallback(async () => {
    try {
      await api(`/api/practice/${type.slug}/reset`, { body: {} });
      setProgress(EMPTY);
      setRound((r) => r + 1); // remount the practice with no saved answers
      setConfirm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Starting over. Your earlier answers stay in your progress history.", "info");
    } catch (e) {
      toast(errorMessage(e), "warning");
    }
  }, [toast, type.slug]);

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

  const done = Object.keys(progress.results).length;
  const total = set.unitCount;
  const complete = total > 0 && done >= total;
  const next = PRACTICE_TYPES[(PRACTICE_TYPES.findIndex((t) => t.slug === type.slug) + 1) % PRACTICE_TYPES.length];
  const props = { type, sidebarExtra };

  return (
    <PracticeProgressProvider value={{ progress, startOver }}>
      {round === 0 && done > 0 && (
        <section aria-label="Your progress" className={`mb-5 flex flex-wrap items-center gap-4 rounded-2xl border-2 p-4 ${complete ? "border-success/40 bg-success-soft/60" : "border-primary/30 bg-primary-soft/60"}`}>
          <Icon3D name={complete ? "achievement" : "continue"} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{complete ? `You have completed all ${total} questions` : "Welcome back! Continuing where you stopped"}</p>
            <p className="text-sm text-body">
              {complete ? "Review your answers below, start over, or move on to the next practice type." : `You have answered ${done} of ${total} questions. Answered ones are marked in the navigator.`}
            </p>
            <ProgressBar value={done} max={total} tone={complete ? "success" : "primary"} size="sm" label={`${done} of ${total} questions answered`} className="mt-2 max-w-md" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<Icon3D name="retry" size={18} />} onClick={() => setConfirm(true)}>
              Start over
            </Button>
            {complete && (
              <LinkButton href={practiceHref(next.slug)} rightIcon={<Icon3D name="next" size={18} />}>
                Next: {next.shortTitle}
              </LinkButton>
            )}
          </div>
        </section>
      )}
      <Practice key={round} view={view} props={props} />
      <ConfirmDialog
        open={confirm}
        title="Start this practice type over?"
        description="All questions will be unanswered again. Your earlier answers stay in your progress history."
        confirmLabel="Start over"
        onCancel={() => setConfirm(false)}
        onConfirm={() => void startOver()}
      />
    </PracticeProgressProvider>
  );
}

function Practice({ view, props }: { view: PracticeSetDTO["view"]; props: { type: PracticeType; sidebarExtra: React.ReactNode } }) {
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
