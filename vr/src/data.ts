/**
 * Question data for the study room: the signed-in learner's own study-plan questions from the
 * LafaekTOEFL API (same origin, session cookie). Visitors sign in and need a study plan before
 * they can enter (see src/index.ts), or try the demo as a guest, who gets the demo questions
 * from the same API.
 */

export interface Audio {
  /** Ready audio files, one per script segment, played in order. */
  assetIds: string[];
  /** Script for the browser-voice fallback (only when no file is ready). */
  script: { speaker: string; text: string }[] | null;
  /** Speaker gender per segment (no words), so each voice comes from the matching person. */
  speakers?: ('female' | 'male' | null)[];
}

export interface SentenceItem {
  itemId: string;
  unitId: string;
  context: string;
  prefix: string | null;
  suffix: string | null;
  tokens: { id: string; text: string }[];
}

export interface ChoiceQuestion {
  unitId: string;
  prompt: string;
  options: { id: string; text: string }[];
}

export interface ListeningItem {
  itemId: string;
  title: string;
  /** conversation | announcement | lecture | response (Listen and Choose a Response). */
  scene?: string;
  imageAssetId: string | null;
  audio: Audio;
  questions: ChoiceQuestion[];
}

export type ReadingDocument =
  | { type: 'email'; from: string; to: string; subject: string; body: string[]; signOff: string }
  | { type: 'notice'; heading: string; body: string[]; footer?: string }
  | { type: 'chat'; title: string; messages: { sender: string; text: string; time: string }[] };

export interface ReadingItem {
  itemId: string;
  title: string;
  /** Read in Daily Life: an email, notice or chat. */
  document?: ReadingDocument;
  /** Read an Academic Passage: the passage paragraphs. */
  paragraphs?: string[];
  questions: ChoiceQuestion[];
}

export interface RepeatItem {
  itemId: string;
  situation: string;
  imageAssetId: string | null;
  sentences: { unitId: string; audio: Audio; responseSeconds: number }[];
}

/** Result of a spoken answer: the transcript, and for Listen and Repeat the word match. */
export interface SpeechResult {
  transcript: string;
  /** Listen and Repeat: share of the sentence's words that matched (0–1). */
  similarity?: number;
  /** Listen and Repeat: the sentence the learner should have said. */
  expected?: string;
  correct?: boolean | null;
}

/** The progress wall's summary of the learner's real practice and latest mock test. */
export interface ProgressSummary {
  questionsAttempted: number;
  /** Percent (0–100), as the progress API returns it. */
  accuracy: number | null;
  studyDays: number;
  practiceMinutes: number;
  skills: Record<'reading' | 'listening' | 'writing' | 'speaking', { done: number; available: number; accuracy: number | null; aiBand: number | null }>;
  mockBand: number | null;
  mockPending: boolean;
  certificate: string | null;
}

/** Which skill each of the 12 practice types belongs to. */
const SLUG_SKILL: Record<string, keyof ProgressSummary['skills']> = {
  'complete-the-words': 'reading',
  'read-in-daily-life': 'reading',
  'read-academic-passage': 'reading',
  'listen-choose-response': 'listening',
  'listen-conversation': 'listening',
  'listen-announcement': 'listening',
  'listen-academic-talk': 'listening',
  'build-sentence': 'writing',
  'write-email': 'writing',
  'academic-discussion': 'writing',
  'listen-repeat': 'speaking',
  'take-interview': 'speaking',
};

export type ReadingSlug = 'read-in-daily-life' | 'read-academic-passage';
export type ListeningSlug = 'listen-choose-response' | 'listen-conversation' | 'listen-announcement' | 'listen-academic-talk';

export interface InterviewItem {
  itemId: string;
  scenario: string;
  questions: { unitId: string; audio: Audio; responseSeconds: number; text?: string }[];
}

export type PartRole = 'opener' | 'connector' | 'subject' | 'verb' | 'object' | 'rest';

export interface CheckResult {
  correct: boolean | null;
  /** The correct answer as text (the sentence, or the option letter). */
  answer?: string;
  explanation?: string;
  /** Build a Sentence: the correct token order (token ids). */
  order?: string[];
  /** Build a Sentence: the grammatical parts of the correct sentence ("Why this order?"). */
  parts?: { role: PartRole; text: string }[];
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
  /** A visitor trying the demo without an account (practises with the demo questions). */
  guest?: boolean;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Every request says it comes from the VR room, so the server logs can show which Meta AI calls
 * (speech transcription, interview scoring) were made from the headset.
 */
const CLIENT_HEADER = { 'X-Lafaek-Client': 'vr-room' };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init, headers: { ...CLIENT_HEADER, ...(init?.headers as Record<string, string> | undefined) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? 'Something went wrong. Please try again.');
  return body as T;
}

const json = (data: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export async function currentUser(): Promise<User | null> {
  return (await sessionState()).user;
}

/** Who is signed in, and (when nobody is) whether the guest demo can be offered. */
export async function sessionState(): Promise<{ user: User | null; guestDemo: boolean }> {
  try {
    const r = await api<{ user: User | null; guestDemo?: boolean }>('/api/auth/session');
    return { user: r.user, guestDemo: Boolean(r.guestDemo) };
  } catch {
    return { user: null, guestDemo: false }; // Not signed in, or not served by the LafaekTOEFL app.
  }
}

/** "Try the demo": signs this browser in as a new guest. */
export async function startGuestDemo(): Promise<void> {
  await api('/api/auth/guest', json({}));
}

/** Whether the signed-in learner has an active study plan (the room uses its questions). */
export async function hasStudyPlan(): Promise<boolean> {
  try {
    const r = await api<{ plan: unknown }>('/api/study-plan');
    return Boolean(r.plan);
  } catch {
    return false;
  }
}

interface PracticeSet<T> {
  view: { items: T[] };
  progress: { results: Record<string, unknown> };
}

/** How far the learner is in one activity, counted since their last "Start over" (like the website). */
export interface Resume {
  answered: number;
  total: number;
}

export class DataSource {
  /** Called after the server saves an answer (checked, spoken or AI-scored), e.g. to refresh the progress wall. */
  onSaved?: () => void;

  /** Per activity: which questions are answered (since the last "Start over") and how many there are. */
  private readonly progressBySlug = new Map<string, Resume & { done: Set<string>; keys: Set<string> }>();
  /** Called when an answer is saved and an activity's progress changes (the "Welcome back" bar). */
  readonly progressListeners = new Set<() => void>();

  constructor(readonly user: User | null) {}

  /**
   * The learner's items for an activity: items with an unanswered question first, finished ones
   * last. Records the progress so the screen can say "Welcome back" and resume mid-item.
   */
  private async practiceItems<T extends { itemId: string }>(slug: string, unitsOf: (item: T) => string[]): Promise<T[]> {
    const set = await api<PracticeSet<T>>(`/api/practice/${slug}/items`);
    const done = new Set(Object.keys(set.progress.results));
    const keys = set.view.items.flatMap((i) => unitsOf(i).map((u) => `${i.itemId}:${u}`));
    this.progressBySlug.set(slug, { answered: keys.filter((k) => done.has(k)).length, total: keys.length, done, keys: new Set(keys) });
    const open = (i: T) => unitsOf(i).some((u) => !done.has(`${i.itemId}:${u}`));
    return [...set.view.items.filter(open), ...set.view.items.filter((i) => !open(i))];
  }

  /** Answered and total questions for an activity (after its items were loaded), or null. */
  resume(slug: string): Resume | null {
    const p = this.progressBySlug.get(slug);
    return p ? { answered: p.answered, total: p.total } : null;
  }

  /** Where to continue inside an item: the first unanswered question (0 when all are done). */
  firstOpen(slug: string, itemId: string, unitIds: string[]): number {
    const done = this.progressBySlug.get(slug)?.done;
    if (!done) return 0;
    const i = unitIds.findIndex((u) => !done.has(`${itemId}:${u}`));
    return i < 0 ? 0 : i;
  }

  /** Counts a question as answered as soon as the server saved it, and tells the listeners. */
  private markDone(itemId: string, unitId: string): void {
    const key = `${itemId}:${unitId}`;
    let changed = false;
    for (const p of this.progressBySlug.values()) {
      if (!p.keys.has(key) || p.done.has(key)) continue;
      p.done.add(key);
      p.answered++;
      changed = true;
    }
    if (changed) for (const fn of this.progressListeners) fn();
  }

  /** "Start over" (same as the website): earlier answers stay in the history but no longer count. */
  async startOver(slug: string): Promise<void> {
    await api(`/api/practice/${slug}/reset`, json({}));
    this.progressBySlug.delete(slug);
  }

  get live(): boolean {
    return this.user !== null;
  }

  /** The learner's Build a Sentence items, unanswered first ([] until their plan has some). */
  sentences(): Promise<SentenceItem[]> {
    return this.practiceItems<SentenceItem>('build-sentence', (i) => [i.unitId]);
  }

  /** Any of the four listening tasks. Listen and Choose a Response is shaped like the others. */
  async listening(slug: ListeningSlug = 'listen-conversation'): Promise<ListeningItem[]> {
    if (slug === 'listen-choose-response') {
      const items = await this.practiceItems<{ itemId: string; audio: Audio; question: ChoiceQuestion }>(slug, (i) => [i.question.unitId]);
      return items.map((i) => ({ itemId: i.itemId, title: 'Choose the best response', scene: 'response', imageAssetId: null, audio: i.audio, questions: [i.question] }));
    }
    return this.practiceItems<ListeningItem>(slug, (i) => i.questions.map((x) => x.unitId));
  }

  reading(slug: ReadingSlug): Promise<ReadingItem[]> {
    return this.practiceItems<ReadingItem>(slug, (i) => i.questions.map((x) => x.unitId));
  }

  repeat(): Promise<RepeatItem[]> {
    return this.practiceItems<RepeatItem>('listen-repeat', (i) => i.sentences.map((x) => x.unitId));
  }

  interview(): Promise<InterviewItem[]> {
    return this.practiceItems<InterviewItem>('take-interview', (i) => i.questions.map((x) => x.unitId));
  }

  /** The learner's progress and latest mock test, for the progress wall. */
  async progress(): Promise<ProgressSummary> {
    type Progress = {
      questionsAttempted: number;
      accuracy: number | null;
      practiceMinutes: number;
      practisedDates: string[];
      bySkill: { skill: string; accuracy: number | null; aiBand: number | null }[];
      byTask: { slug: string; doneUnits: number; availableUnits: number }[];
    };
    const [{ progress: pr }, mock] = await Promise.all([
      api<{ progress: Progress }>('/api/progress'),
      api<{ result: { estimatedBand: number | null; scoring: string | null; certificateCode: string | null } | null }>('/api/mock-test/latest').catch(() => ({ result: null })),
    ]);
    const skills = {
      reading: { done: 0, available: 0, accuracy: null, aiBand: null },
      listening: { done: 0, available: 0, accuracy: null, aiBand: null },
      writing: { done: 0, available: 0, accuracy: null, aiBand: null },
      speaking: { done: 0, available: 0, accuracy: null, aiBand: null },
    } as ProgressSummary['skills'];
    for (const t of pr.byTask) {
      const k = SLUG_SKILL[t.slug];
      if (!k) continue;
      skills[k].done += Math.min(t.doneUnits, t.availableUnits);
      skills[k].available += t.availableUnits;
    }
    for (const b of pr.bySkill) {
      const k = b.skill as keyof ProgressSummary['skills'];
      if (skills[k]) {
        skills[k].accuracy = b.accuracy;
        skills[k].aiBand = b.aiBand;
      }
    }
    return {
      questionsAttempted: pr.questionsAttempted,
      accuracy: pr.accuracy,
      studyDays: new Set(pr.practisedDates).size,
      practiceMinutes: Math.round(pr.practiceMinutes),
      skills,
      mockBand: mock.result?.estimatedBand ?? null,
      mockPending: mock.result?.scoring === 'pending',
      certificate: mock.result?.certificateCode ?? null,
    };
  }

  /** Checks one objective answer on the server. */
  async check(itemId: string, unitId: string, response: string | string[]): Promise<CheckResult> {
    const r = await api<{ results: Record<string, { correct: boolean | null; answer?: unknown; label?: string; explanation?: string; parts?: CheckResult['parts'] }> }>(
      `/api/practice/items/${itemId}/submit`,
      json({ responses: [{ unitId, response }] }),
    );
    const u = r.results[unitId];
    this.markDone(itemId, unitId);
    this.onSaved?.();
    return {
      correct: u?.correct ?? null,
      answer: u?.label || (typeof u?.answer === 'string' ? u.answer : undefined),
      explanation: u?.explanation,
      order: Array.isArray(u?.answer) ? u.answer.map(String) : undefined,
      parts: u?.parts,
    };
  }

  /** Same-origin media bytes (images and audio) for an asset the learner owns. */
  async media(assetId: string): Promise<Blob> {
    const res = await fetch(`/api/media/${assetId}/file`, { credentials: 'same-origin' });
    if (!res.ok) throw new ApiError(res.status, 'This media is not available.');
    return res.blob();
  }

  /** Uploads a spoken answer (16 kHz WAV) and returns the transcript. */
  async transcribe(itemId: string, unitId: string, wav: Blob): Promise<string> {
    return (await this.speak(itemId, unitId, wav)).transcript;
  }

  /** Uploads a spoken answer; for Listen and Repeat the result includes the word match. */
  async speak(itemId: string, unitId: string, wav: Blob): Promise<SpeechResult> {
    const form = new FormData();
    form.set('unitId', unitId);
    form.set('audio', wav, 'answer.wav');
    const r = await api<{ results: Record<string, { transcript?: string; similarity?: number; answer?: unknown; correct?: boolean | null }> }>(
      `/api/practice/items/${itemId}/speaking`,
      { method: 'POST', body: form },
    );
    const u = r.results[unitId];
    this.markDone(itemId, unitId);
    this.onSaved?.();
    return { transcript: u?.transcript ?? '', similarity: u?.similarity, expected: typeof u?.answer === 'string' ? u.answer : undefined, correct: u?.correct };
  }

  /** AI band score (1–6) and coaching for an interview answer. */
  async score(itemId: string, unitId: string, transcript: string): Promise<AiScore> {
    const r = await api<{ feedback: AiScore }>(`/api/practice/items/${itemId}/feedback`, json({ unitId, text: transcript }));
    this.onSaved?.();
    return r.feedback;
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
