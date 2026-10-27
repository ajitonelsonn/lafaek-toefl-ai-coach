"use client";

import { useState } from "react";
import type { VocabWord } from "@/lib/services/types";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface Question {
  word: VocabWord;
  options: string[];
}

function buildQuiz(words: VocabWord[], size = 5): Question[] {
  const pool = [...words].sort(() => Math.random() - 0.5).slice(0, Math.min(size, words.length));
  return pool.map((word) => {
    const others = words.filter((w) => w.id !== word.id).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [word.word, ...others.map((o) => o.word)].sort(() => Math.random() - 0.5);
    return { word, options };
  });
}

/** Five-question meaning quiz built from the current category. */
export function VocabularyQuiz({ open, onClose, words }: { open: boolean; onClose: () => void; words: VocabWord[] }) {
  const [quiz, setQuiz] = useState<Question[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const start = () => {
    setQuiz(buildQuiz(words));
    setI(0);
    setPicked(null);
    setScore(0);
  };

  const close = () => {
    setQuiz(null);
    onClose();
  };

  const tooFew = words.length < 4;
  const done = quiz && i >= quiz.length;
  const q = quiz && !done ? quiz[i] : null;

  return (
    <Dialog open={open} onClose={close} title="Vocabulary Quiz" size="md" description={!quiz ? "Choose the word that matches each meaning." : undefined}>
      {!quiz ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-body">{tooFew ? "Choose a category with at least 4 words, or pick “All”." : `5 questions from ${words.length} sample words.`}</p>
          <Button onClick={start} disabled={tooFew}>
            Start quiz
          </Button>
        </div>
      ) : done ? (
        <div className="flex flex-col items-center gap-3 text-center" role="status">
          <p className="text-4xl font-extrabold text-ink">
            {score} / {quiz.length}
          </p>
          <p className="text-body">{score === quiz.length ? "Perfect score!" : score >= 3 ? "Good job!" : "Keep practising!"}</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={start}>
              Try again
            </Button>
            <Button onClick={close}>Close</Button>
          </div>
        </div>
      ) : (
        q && (
          <div>
            <p className="text-sm font-semibold text-muted">
              Question {i + 1} of {quiz.length}
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">“{q.word.meaning}”</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Answer options">
              {q.options.map((o) => {
                const isAnswer = o === q.word.word;
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => {
                      setPicked(o);
                      if (isAnswer) setScore((s) => s + 1);
                    }}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left font-semibold transition-colors",
                      picked === null && "border-line hover:border-primary",
                      picked !== null && isAnswer && "border-success bg-success-soft text-success",
                      picked === o && !isAnswer && "border-danger bg-danger-soft text-danger",
                      picked !== null && !isAnswer && picked !== o && "border-line opacity-60",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="mt-4 flex items-center justify-between gap-3" role="status">
                <p className={cn("text-sm font-semibold", picked === q.word.word ? "text-success" : "text-danger")}>
                  {picked === q.word.word ? "Correct!" : `The answer is “${q.word.word}”.`}
                </p>
                <Button
                  onClick={() => {
                    setPicked(null);
                    setI((n) => n + 1);
                  }}
                >
                  {i + 1 < quiz.length ? "Next" : "See score"}
                </Button>
              </div>
            )}
          </div>
        )
      )}
    </Dialog>
  );
}
