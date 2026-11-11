/**
 * Question data for the study room: the signed-in learner's own study-plan questions from the
 * LafaekTOEFL API (same origin, session cookie). Visitors must sign in and have a study plan
 * before they can enter (see src/index.ts), so there is no demo data.
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
    return null; // Not signed in, or not served by the LafaekTOEFL app.
  }
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

  /** The learner's Build a Sentence items, unanswered first ([] until their plan has some). */
  sentences(): Promise<SentenceItem[]> {
    return practiceItems<SentenceItem>('build-sentence', (i) => i.unitId);
  }

  listening(): Promise<ListeningItem[]> {
    return practiceItems<ListeningItem>('listen-conversation', (i) => i.questions[0]?.unitId ?? '');
  }

  interview(): Promise<InterviewItem[]> {
    return practiceItems<InterviewItem>('take-interview', (i) => i.questions[0]?.unitId ?? '');
  }

  /** Checks one objective answer on the server. */
  async check(itemId: string, unitId: string, response: string | string[]): Promise<CheckResult> {
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
