/**
 * Question data for the study room. Signed-in learners get their own study-plan questions from
 * the LafaekTOEFL API (same origin, session cookie). Everyone else gets a small demo set made
 * from the app's hand-written starter questions, checked locally.
 */

export interface Audio {
  /** Ready audio files, one per script segment, played in order. */
  assetIds: string[];
  /** Script for the browser-voice fallback (only when no file is ready). */
  script: { speaker: string; text: string }[] | null;
}

export interface SentenceItem {
  itemId: string;
  unitId: string;
  context: string;
  prefix: string | null;
  suffix: string | null;
  tokens: { id: string; text: string }[];
  /** Demo only: the correct token order, the answer sentence and why. */
  demo?: { order: string[]; answer: string; explanation: string };
}

export interface ChoiceQuestion {
  unitId: string;
  prompt: string;
  options: { id: string; text: string }[];
  demo?: { answerId: string; explanation: string };
}

export interface ListeningItem {
  itemId: string;
  title: string;
  imageAssetId: string | null;
  audio: Audio;
  questions: ChoiceQuestion[];
}

export interface InterviewItem {
  itemId: string;
  scenario: string;
  questions: { unitId: string; audio: Audio; responseSeconds: number; text?: string }[];
}

export interface CheckResult {
  correct: boolean | null;
  answer?: string;
  explanation?: string;
}

export interface AiScore {
  band?: number;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface User {
  id: string;
  name: string | null;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? 'Something went wrong. Please try again.');
  return body as T;
}

const json = (data: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export async function currentUser(): Promise<User | null> {
  try {
    const r = await api<{ user: User | null }>('/api/auth/session');
    return r.user;
  } catch {
    return null; // Not served by the LafaekTOEFL app (local dev) or offline: demo mode.
  }
}

interface PracticeSet<T> {
  view: { items: T[] };
  progress: { results: Record<string, unknown> };
}

/** The learner's items for a task, unanswered ones first; empty when they have none. */
async function practiceItems<T extends { itemId: string }>(slug: string, unitOf: (item: T) => string): Promise<T[]> {
  const set = await api<PracticeSet<T>>(`/api/practice/${slug}/items`);
  const done = (i: T) => `${i.itemId}:${unitOf(i)}` in set.progress.results;
  return [...set.view.items.filter((i) => !done(i)), ...set.view.items.filter(done)];
}

export class DataSource {
  constructor(readonly user: User | null) {}

  get live(): boolean {
    return this.user !== null;
  }

  async sentences(): Promise<{ items: SentenceItem[]; demo: boolean }> {
    if (this.user) {
      const items = await practiceItems<SentenceItem>('build-sentence', (i) => i.unitId).catch(() => []);
      if (items.length) return { items, demo: false };
    }
    return { items: DEMO_SENTENCES, demo: true };
  }

  async listening(): Promise<{ items: ListeningItem[]; demo: boolean }> {
    if (this.user) {
      const items = await practiceItems<ListeningItem>('listen-conversation', (i) => i.questions[0]?.unitId ?? '').catch(() => []);
      if (items.length) return { items, demo: false };
    }
    return { items: [DEMO_LISTENING], demo: true };
  }

  async interview(): Promise<{ items: InterviewItem[]; demo: boolean }> {
    if (this.user) {
      const items = await practiceItems<InterviewItem>('take-interview', (i) => i.questions[0]?.unitId ?? '').catch(() => []);
      if (items.length) return { items, demo: false };
    }
    return { items: [DEMO_INTERVIEW], demo: true };
  }

  /** Checks one objective answer: on the server for real items, locally for demo items. */
  async check(itemId: string, unitId: string, response: string | string[]): Promise<CheckResult> {
    const demoSentence = DEMO_SENTENCES.find((s) => s.itemId === itemId);
    if (demoSentence?.demo) {
      const order = response as string[];
      const correct = order.length === demoSentence.demo.order.length && order.every((t, i) => t === demoSentence.demo!.order[i]);
      return { correct, answer: demoSentence.demo.answer, explanation: demoSentence.demo.explanation };
    }
    const demoQ = DEMO_LISTENING.itemId === itemId ? DEMO_LISTENING.questions.find((q) => q.unitId === unitId) : undefined;
    if (demoQ?.demo) {
      const correct = response === demoQ.demo.answerId;
      return { correct, answer: demoQ.demo.answerId, explanation: demoQ.demo.explanation };
    }
    const r = await api<{ results: Record<string, { correct: boolean | null; answer?: unknown; label?: string; explanation?: string }> }>(
      `/api/practice/items/${itemId}/submit`,
      json({ responses: [{ unitId, response }] }),
    );
    const u = r.results[unitId];
    return { correct: u?.correct ?? null, answer: u?.label || (typeof u?.answer === 'string' ? u.answer : undefined), explanation: u?.explanation };
  }

  /** Same-origin media bytes (images and audio) for an asset the learner owns. */
  async media(assetId: string): Promise<Blob> {
    const res = await fetch(`/api/media/${assetId}/file`, { credentials: 'same-origin' });
    if (!res.ok) throw new ApiError(res.status, 'This media is not available.');
    return res.blob();
  }

  /** Uploads a spoken answer (16 kHz WAV) and returns the transcript. */
  async transcribe(itemId: string, unitId: string, wav: Blob): Promise<string> {
    const form = new FormData();
    form.set('unitId', unitId);
    form.set('audio', wav, 'answer.wav');
    const r = await api<{ results: Record<string, { transcript?: string }> }>(`/api/practice/items/${itemId}/speaking`, { method: 'POST', body: form });
    return r.results[unitId]?.transcript ?? '';
  }

  /** AI band score (1–6) and coaching for an interview answer. */
  async score(itemId: string, unitId: string, transcript: string): Promise<AiScore> {
    const r = await api<{ feedback: AiScore }>(`/api/practice/items/${itemId}/feedback`, json({ unitId, text: transcript }));
    return r.feedback;
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------------------------
// Demo set: hand-written LafaekTOEFL starter questions (prisma/starter/questions).

export const DEMO_SENTENCES: SentenceItem[] = [
  {
    itemId: 'demo-bs-1',
    unitId: 'a',
    context: 'The annual technology conference was an enormous success.',
    prefix: null,
    suffix: "for next year's event?",
    // Shown shuffled; the order below is the answer.
    tokens: [
      { id: 't4', text: 'they announced' },
      { id: 't0', text: 'do' },
      { id: 't3', text: 'if' },
      { id: 't5', text: 'the dates' },
      { id: 't1', text: 'you' },
      { id: 't2', text: 'know' },
    ],
    demo: {
      order: ['t0', 't1', 't2', 't3', 't4', 't5'],
      answer: "Do you know if they announced the dates for next year's event?",
      explanation: 'After "Do you know if…", use statement order: subject + verb (they announced) + object (the dates).',
    },
  },
  {
    itemId: 'demo-bs-2',
    unitId: 'a',
    context: 'The seminar on climate change was eye-opening.',
    prefix: null,
    suffix: 'available online?',
    tokens: [
      { id: 't3', text: 'whether' },
      { id: 't5', text: 'is' },
      { id: 't0', text: 'can' },
      { id: 't2', text: 'tell me' },
      { id: 't4', text: 'it' },
      { id: 't1', text: 'you' },
    ],
    demo: {
      order: ['t0', 't1', 't2', 't3', 't4', 't5'],
      answer: 'Can you tell me whether it is available online?',
      explanation: 'Inside "Can you tell me whether…", keep statement order: subject (it) + verb (is), not "is it".',
    },
  },
  {
    itemId: 'demo-bs-3',
    unitId: 'a',
    context: 'The art exhibit at the gallery is stunning.',
    prefix: null,
    suffix: 'next month?',
    tokens: [
      { id: 't5', text: 'will still' },
      { id: 't2', text: 'know' },
      { id: 't0', text: 'do' },
      { id: 't6', text: 'be open' },
      { id: 't4', text: 'it' },
      { id: 't1', text: 'you' },
      { id: 't3', text: 'if' },
    ],
    demo: {
      order: ['t0', 't1', 't2', 't3', 't4', 't5', 't6'],
      answer: 'Do you know if it will still be open next month?',
      explanation: 'Statement order after "Do you know if…": subject (it) + verb (will still be open). "Still" goes between "will" and "be".',
    },
  },
];

export const DEMO_LISTENING: ListeningItem = {
  itemId: 'demo-lc-1',
  title: 'At the Library Help Desk',
  imageAssetId: null,
  audio: {
    assetIds: [],
    script: [
      { speaker: 'Student', text: "Hi, I'm looking for a quiet place to study. The first floor is really busy today." },
      { speaker: 'Librarian', text: "Yes, there's a workshop down here this afternoon. The second floor has silent study rooms." },
      { speaker: 'Student', text: 'Great. Do I need to book a room?' },
      { speaker: 'Librarian', text: "Not on weekdays, but they fill up fast. I'd suggest checking the room screen by the elevator before you go upstairs. It shows which rooms are free." },
      { speaker: 'Student', text: 'Perfect, thanks. And can I bring my coffee?' },
      { speaker: 'Librarian', text: "Drinks with a lid are fine. Food isn't allowed in the silent rooms, though." },
    ],
  },
  questions: [
    {
      unitId: 'a',
      prompt: 'What is the main reason the student is visiting the help desk?',
      options: [
        { id: 'A', text: 'To return a book' },
        { id: 'B', text: 'To find a quiet place to study' },
        { id: 'C', text: 'To print a document' },
        { id: 'D', text: 'To join a workshop' },
      ],
      demo: { answerId: 'B', explanation: 'The student begins: "I\'m looking for a quiet place to study."' },
    },
    {
      unitId: 'b',
      prompt: 'What does the librarian suggest the student do before going upstairs?',
      options: [
        { id: 'A', text: 'Book a room online' },
        { id: 'B', text: 'Finish their coffee' },
        { id: 'C', text: 'Check the room screen by the elevator' },
        { id: 'D', text: 'Sign up for the workshop' },
      ],
      demo: { answerId: 'C', explanation: '"I\'d suggest checking the room screen by the elevator before you go upstairs."' },
    },
    {
      unitId: 'c',
      prompt: 'What is allowed in the silent study rooms?',
      options: [
        { id: 'A', text: 'Snacks' },
        { id: 'B', text: 'Drinks with a lid' },
        { id: 'C', text: 'Phone calls' },
        { id: 'D', text: 'Group discussions' },
      ],
      demo: { answerId: 'B', explanation: '"Drinks with a lid are fine. Food isn\'t allowed in the silent rooms."' },
    },
  ],
};

const interviewQ = (unitId: string, text: string) => ({ unitId, text, responseSeconds: 45, audio: { assetIds: [], script: [{ speaker: 'Researcher', text }] } });

export const DEMO_INTERVIEW: InterviewItem = {
  itemId: 'demo-ti-1',
  scenario: "You volunteered for a research study about people's experiences with gardening. A researcher will ask you some questions.",
  questions: [
    interviewQ('a', 'Thank you for joining us. To begin, do you have any experience with gardening? Please tell me about it.'),
    interviewQ('b', 'What do you think people enjoy most about gardening? Why?'),
    interviewQ('c', 'Some people say gardening is a good activity for children. Do you agree? Why or why not?'),
  ],
};
