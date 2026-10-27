// Vocabulary categories. The words themselves are generated per learner from their own
// practice questions (lib/server/generation/vocabulary.ts); there is no fixed word list.
import type { VocabCategory } from "@/lib/services/types";

export const VOCAB_CATEGORIES: { id: VocabCategory; label: string }[] = [
  { id: "academic", label: "Academic" },
  { id: "campus", label: "Campus Life" },
  { id: "science", label: "Science" },
  { id: "business", label: "Business" },
  { id: "environment", label: "Environment" },
  { id: "health", label: "Health" },
  { id: "technology", label: "Technology" },
];
