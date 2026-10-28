import "server-only";
import { z } from "zod";
import type { PracticeSlug } from "@/lib/config/practice-types";
import { addCTestBlanks } from "./c-test";

// Generation output schemas (what the model must return) and the stored item
// format. Schemas use strictObject + nullable (never optional) so they map to
// Meta's strict JSON-schema subset: every key required, no extra keys.

const cefr = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const difficulty = z.enum(["easy", "medium", "hard"]);
const meta = { topic: z.string().min(2).max(80), cefrLevel: cefr, difficulty };

const choiceQuestion = z.strictObject({
  prompt: z.string().min(5).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10).max(400),
});

const speaker = z.strictObject({
  id: z.string().regex(/^S[1-3]$/),
  role: z.enum(["student", "staff", "professor", "lecturer", "announcer", "interviewer", "narrator", "friend"]),
  name: z.string().min(1).max(40),
});

const scriptLine = z.strictObject({ speakerId: z.string().regex(/^S[1-3]$/), text: z.string().min(2).max(600) });

export const GEN_SCHEMAS = {
  "complete-the-words": z.strictObject({
    ...meta,
    title: z.string().min(3).max(80),
    passage: z.string().min(200).max(1600),
  }),
  "read-in-daily-life": z.strictObject({
    ...meta,
    title: z.string().min(3).max(80),
    document: z.strictObject({
      type: z.enum(["email", "notice", "chat"]),
      from: z.string().max(80).nullable(),
      to: z.string().max(80).nullable(),
      subject: z.string().max(120).nullable(),
      heading: z.string().max(120).nullable(),
      body: z.array(z.string().min(1).max(900)).max(6),
      signOff: z.string().max(120).nullable(),
      footer: z.string().max(200).nullable(),
      messages: z.array(z.strictObject({ sender: z.string().min(1).max(30), text: z.string().min(1).max(300), time: z.string().max(12) })).max(8),
    }),
    questions: z.array(choiceQuestion).min(2).max(3),
  }),
  "read-academic-passage": z.strictObject({
    ...meta,
    title: z.string().min(3).max(100),
    paragraphs: z.array(z.string().min(150).max(1200)).min(3).max(5),
    questions: z.array(choiceQuestion.extend({ type: z.enum(["main_idea", "detail", "inference", "vocabulary", "purpose", "organization"]) })).min(4).max(6),
  }),
  "listen-choose-response": z.strictObject({
    ...meta,
    speakerRole: z.enum(["student", "staff", "professor", "friend"]),
    prompt: z.string().min(5).max(200),
    options: z.array(z.string().min(1).max(160)).length(4),
    answerIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(10).max(400),
  }),
  "listen-conversation": listeningSet(2, 3, 4, 16),
  "listen-announcement": listeningSet(1, 1, 1, 6),
  "listen-academic-talk": listeningSet(1, 2, 1, 10),
  "build-sentence": z.strictObject({
    ...meta,
    context: z.string().min(5).max(200),
    prefix: z.string().max(60).nullable(),
    suffix: z.string().max(60).nullable(),
    tokens: z.array(z.string().min(1).max(30)).min(4).max(8),
    parts: z.array(z.strictObject({ role: z.enum(["opener", "connector", "subject", "verb", "object", "rest"]), text: z.string().min(1).max(60) })).min(2).max(8),
    explanation: z.string().min(20).max(400),
  }),
  "write-email": z.strictObject({
    ...meta,
    scenario: z.string().min(80).max(700),
    recipient: z.string().min(1).max(60),
    subject: z.string().min(3).max(100),
    bullets: z.array(z.string().min(10).max(200)).length(3),
    tips: z.array(z.string().min(3).max(120)).min(3).max(5),
    imagePrompt: z.string().min(10).max(300).nullable(),
  }),
  "academic-discussion": z.strictObject({
    ...meta,
    courseTopic: z.string().min(3).max(80),
    professorName: z.string().min(3).max(40),
    professorPrompt: z.string().min(150).max(900),
    students: z.array(z.strictObject({ name: z.string().min(2).max(30), text: z.string().min(120).max(700) })).length(2),
    tips: z.array(z.string().min(3).max(120)).min(3).max(5),
  }),
  "listen-repeat": z.strictObject({
    ...meta,
    situation: z.string().min(40).max(400),
    sentences: z.array(z.string().min(10).max(140)).length(7),
    imagePrompt: z.string().min(10).max(300).nullable(),
  }),
  "take-interview": z.strictObject({
    ...meta,
    scenario: z.string().min(60).max(500),
    questions: z.array(z.string().min(15).max(300)).length(4),
  }),
} satisfies Record<PracticeSlug, z.ZodType>;

function listeningSet(minSpeakers: number, maxSpeakers: number, minLines: number, maxLines: number) {
  return z.strictObject({
    ...meta,
    title: z.string().min(3).max(80),
    speakers: z.array(speaker).min(minSpeakers).max(maxSpeakers),
    script: z.array(scriptLine).min(minLines).max(maxLines),
    questions: z.array(choiceQuestion).min(2).max(5),
    imagePrompt: z.string().min(10).max(300).nullable(),
  });
}

export type GenOutput<S extends PracticeSlug> = z.infer<(typeof GEN_SCHEMAS)[S]>;

/** Stored item, ready for the practice_items table. */
export interface StoredItem {
  difficulty: string;
  cefrLevel: string;
  topic: string;
  content: Record<string, unknown>;
  answerKey: Record<string, unknown>;
  explanation: Record<string, unknown>;
  rubric: Record<string, unknown> | null;
  /** Audio segments to synthesise: role → ordered lines. Empty for silent tasks. */
  audioPlan: { role: string; lines: { speaker: { id: string; role: string; name: string }; text: string }[] }[];
  imagePrompt: string | null;
}

const LETTERS = ["A", "B", "C", "D"];
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Structural checks beyond the schema. Returns human-readable problems (empty = valid). */
export function validateGenerated(slug: PracticeSlug, raw: unknown): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  // Complete the Words: the model writes a plain paragraph and the blanks are made here, as on the real test.
  const input =
    slug === "complete-the-words" && raw && typeof raw === "object" && typeof (raw as { passage?: unknown }).passage === "string"
      ? { ...raw, passage: addCTestBlanks((raw as { passage: string }).passage) }
      : raw;
  const parsed = GEN_SCHEMAS[slug].safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const v = parsed.data as Record<string, unknown>;
  const errors: string[] = [];
  const checkChoices = (qs: { options: string[]; prompt: string }[]) =>
    qs.forEach((q, i) => {
      if (new Set(q.options.map(norm)).size !== 4) errors.push(`question ${i + 1}: options must be distinct`);
    });

  switch (slug) {
    case "complete-the-words": {
      const blanks = [...String(v.passage).matchAll(/(\S*?)\[([^\]]*)\]/g)];
      // Blanks made here must number exactly 10; already-marked passages (starter set) may have 8–12.
      const madeHere = !String((raw as { passage?: unknown } | null)?.passage ?? "").includes("[");
      if (madeHere ? blanks.length !== 10 : blanks.length < 8 || blanks.length > 12) {
        errors.push(madeHere ? `only ${blanks.length} of 10 blanks fit after the first sentence; write a longer paragraph with more common words` : `expected 8–12 blanks, found ${blanks.length}`);
      }
      blanks.forEach((m, i) => {
        if (!/^[A-Za-z]{1,6}$/.test(m[2])) errors.push(`blank ${i + 1}: missing letters must be 1–6 letters`);
        if (!/[A-Za-z]$/.test(m[1])) errors.push(`blank ${i + 1}: needs at least one visible letter before it`);
      });
      if (words(String(v.passage).replace(/\[[^\]]*\]/g, "")) < 50) errors.push("passage is too short");
      break;
    }
    case "read-in-daily-life": {
      const d = v.document as GenOutput<"read-in-daily-life">["document"];
      if (d.type === "email" && (!d.from || !d.to || !d.subject || d.body.length === 0)) errors.push("email needs from, to, subject and body");
      if (d.type === "notice" && (!d.heading || d.body.length === 0)) errors.push("notice needs heading and body");
      if (d.type === "chat" && d.messages.length < 3) errors.push("chat needs at least 3 messages");
      checkChoices(v.questions as never);
      break;
    }
    case "read-academic-passage":
      checkChoices(v.questions as never);
      break;
    case "listen-choose-response":
      checkChoices([{ options: v.options as string[], prompt: String(v.prompt) }]);
      break;
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk": {
      const ids = new Set((v.speakers as { id: string }[]).map((s) => s.id));
      if (ids.size !== (v.speakers as unknown[]).length) errors.push("speaker ids must be unique");
      (v.script as { speakerId: string }[]).forEach((l, i) => !ids.has(l.speakerId) && errors.push(`script line ${i + 1}: unknown speaker`));
      if (slug === "listen-conversation" && new Set((v.script as { speakerId: string }[]).map((l) => l.speakerId)).size < 2) {
        errors.push("conversation must use at least two speakers");
      }
      checkChoices(v.questions as never);
      break;
    }
    case "build-sentence": {
      const tokens = v.tokens as string[];
      if (new Set(tokens.map(norm)).size !== tokens.length) errors.push("word groups must be distinct");
      const sentence = [v.prefix, ...tokens, v.suffix].filter(Boolean).join(" ");
      if (!/[.?!]$/.test(sentence.trim())) errors.push("the full sentence must end with punctuation (put it in the suffix)");
      break;
    }
    case "academic-discussion": {
      const names = (v.students as { name: string }[]).map((s) => norm(s.name));
      if (names[0] === names[1]) errors.push("student names must differ");
      break;
    }
    case "listen-repeat":
      (v.sentences as string[]).forEach((s, i) => (words(s) < 3 || words(s) > 20) && errors.push(`sentence ${i + 1}: use 3–20 words`));
      break;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: v };
}

/** Converts a validated generation output into the stored item format. */
export function toStoredItem(slug: PracticeSlug, value: unknown): StoredItem {
  const v = value as Record<string, unknown> & { topic: string; cefrLevel: string; difficulty: string };
  const base: Pick<StoredItem, "difficulty" | "cefrLevel" | "topic" | "rubric" | "audioPlan" | "imagePrompt"> = {
    difficulty: v.difficulty,
    cefrLevel: v.cefrLevel,
    topic: v.topic,
    rubric: null,
    audioPlan: [],
    imagePrompt: null,
  };
  const questionsOf = (qs: { prompt: string; options: string[]; answerIndex: number; explanation: string }[]) => ({
    content: qs.map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt, options: q.options.map((t, j) => ({ id: LETTERS[j], text: t })) })),
    answerKey: Object.fromEntries(qs.map((q, i) => [`q${i + 1}`, LETTERS[q.answerIndex]])),
    explanation: Object.fromEntries(qs.map((q, i) => [`q${i + 1}`, q.explanation])),
  });

  switch (slug) {
    case "complete-the-words": {
      const text = String(v.passage);
      const segments: unknown[] = [];
      const answerKey: Record<string, string> = {};
      let last = 0;
      let n = 0;
      for (const m of text.matchAll(/(\S*?)\[([^\]]+)\]/g)) {
        const start = m.index ?? 0;
        if (start > last) segments.push({ type: "text", text: text.slice(last, start) });
        const unitId = `b${n++}`;
        segments.push({ type: "blank", unitId, prefix: m[1], length: m[2].length });
        answerKey[unitId] = m[2].toLowerCase();
        last = start + m[0].length;
      }
      if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
      return { ...base, content: { title: v.title, segments }, answerKey, explanation: { fullText: text.replace(/\[([^\]]+)\]/g, "$1") } };
    }
    case "read-in-daily-life": {
      const q = questionsOf(v.questions as never);
      const d = v.document as GenOutput<"read-in-daily-life">["document"];
      const document =
        d.type === "email"
          ? { type: "email", from: d.from, to: d.to, subject: d.subject, body: d.body, signOff: d.signOff ?? "" }
          : d.type === "notice"
            ? { type: "notice", heading: d.heading, body: d.body, footer: d.footer ?? undefined }
            : { type: "chat", title: d.heading ?? v.title, messages: d.messages };
      return { ...base, content: { title: v.title, document, questions: q.content }, answerKey: q.answerKey, explanation: q.explanation };
    }
    case "read-academic-passage": {
      const q = questionsOf(v.questions as never);
      return { ...base, content: { title: v.title, paragraphs: v.paragraphs, questions: q.content }, answerKey: q.answerKey, explanation: q.explanation };
    }
    case "listen-choose-response": {
      const sp = { id: "S1", role: String(v.speakerRole), name: "Speaker" };
      return {
        ...base,
        content: { question: { id: "q1", prompt: "Choose the best response.", options: (v.options as string[]).map((t, j) => ({ id: LETTERS[j], text: t })) }, script: [{ speaker: sp, text: v.prompt }] },
        answerKey: { q1: LETTERS[v.answerIndex as number] },
        explanation: { q1: v.explanation },
        audioPlan: [{ role: "main", lines: [{ speaker: sp, text: String(v.prompt) }] }],
      };
    }
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk": {
      const q = questionsOf(v.questions as never);
      const speakers = v.speakers as { id: string; role: string; name: string }[];
      const lines = (v.script as { speakerId: string; text: string }[]).map((l) => ({ speaker: speakers.find((s) => s.id === l.speakerId)!, text: l.text }));
      const scene = slug === "listen-conversation" ? "conversation" : slug === "listen-announcement" ? "announcement" : "lecture";
      return {
        ...base,
        content: { title: v.title, scene, speakers, script: lines, questions: q.content },
        answerKey: q.answerKey,
        explanation: q.explanation,
        audioPlan: [{ role: "main", lines }],
        imagePrompt: (v.imagePrompt as string | null) ?? null,
      };
    }
    case "build-sentence": {
      const tokens = v.tokens as string[];
      const ids = tokens.map((_, i) => `t${i + 1}`);
      const shuffled = deterministicShuffle(ids, `${v.context}|${tokens.join("|")}`);
      const sentence = [v.prefix, ...tokens, v.suffix].filter(Boolean).join(" ").replace(/\s+([?.!,])/g, "$1");
      return {
        ...base,
        content: { context: v.context, prefix: v.prefix, suffix: v.suffix, tokens: shuffled.map((id) => ({ id, text: tokens[ids.indexOf(id)] })) },
        answerKey: { s: ids },
        explanation: { answer: sentence.charAt(0).toUpperCase() + sentence.slice(1), parts: v.parts, explanation: v.explanation },
      };
    }
    case "write-email":
      return {
        ...base,
        content: { scenario: v.scenario, recipient: v.recipient, subject: v.subject, bullets: v.bullets, checklist: v.bullets, tips: v.tips, minWords: 80, maxWords: null },
        answerKey: {},
        explanation: {},
        rubric: WRITING_RUBRIC,
        imagePrompt: (v.imagePrompt as string | null) ?? null,
      };
    case "academic-discussion": {
      return {
        ...base,
        content: {
          scenario: `Your professor is teaching a class on ${v.courseTopic}. Write a post responding to the professor's question.`,
          professor: { name: v.professorName, prompt: v.professorPrompt },
          students: v.students,
          bullets: ["Express and support your opinion.", "Make a contribution to the discussion in your own words."],
          checklist: ["Express and support your opinion.", "Make a contribution to the discussion in your own words."],
          tips: v.tips,
          minWords: 100,
          maxWords: 300,
        },
        answerKey: {},
        explanation: {},
        rubric: DISCUSSION_RUBRIC,
      };
    }
    case "listen-repeat": {
      const sentences = v.sentences as string[];
      const sp = { id: "S1", role: "narrator", name: "Speaker" };
      return {
        ...base,
        content: { situation: v.situation, sentences: sentences.map((_, i) => ({ id: `r${i + 1}`, responseSeconds: responseSecondsFor(sentences[i]) })), script: sentences },
        answerKey: Object.fromEntries(sentences.map((s, i) => [`r${i + 1}`, s])),
        explanation: {},
        audioPlan: sentences.map((s, i) => ({ role: `r${i + 1}`, lines: [{ speaker: sp, text: s }] })),
        imagePrompt: (v.imagePrompt as string | null) ?? null,
      };
    }
    case "take-interview": {
      const qs = v.questions as string[];
      const sp = { id: "S1", role: "interviewer", name: "Interviewer" };
      return {
        ...base,
        content: { scenario: v.scenario, questions: qs.map((text, i) => ({ id: `i${i + 1}`, responseSeconds: 45, text })) },
        answerKey: {},
        explanation: {},
        rubric: SPEAKING_RUBRIC,
        audioPlan: qs.map((text, i) => ({ role: `i${i + 1}`, lines: [{ speaker: sp, text }] })),
      };
    }
  }
}

function responseSecondsFor(sentence: string) {
  const n = words(sentence);
  return n <= 7 ? 8 : n <= 11 ? 10 : 12;
}

export function deterministicShuffle<T>(arr: T[], seedText: string): T[] {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((v, i) => v === arr[i])) [out[0], out[1]] = [out[1], out[0]];
  return out;
}

// Practice rubrics built on the scoring dimensions ETS describes for the 2026 tasks (content and
// coherence, sentence variety, vocabulary and collocations, politeness for emails, accuracy; for
// the interview, relevance, organization and language use). Not the official ETS rubrics.
export const WRITING_RUBRIC = {
  version: "writing-rubric-2",
  dimensions: ["Covers every point", "Coherence and transitions", "Sentence variety", "Vocabulary and collocations", "Politeness and tone", "Grammar and mechanics"],
  note: "Practice rubric. Not an official ETS scoring rubric.",
};

export const DISCUSSION_RUBRIC = {
  version: "discussion-rubric-1",
  dimensions: ["Clear opinion that adds to the discussion", "Reason and example", "Coherence and transitions", "Sentence variety", "Vocabulary and collocations", "Grammar and mechanics"],
  note: "Practice rubric. Not an official ETS scoring rubric.",
};

export const SPEAKING_RUBRIC = {
  version: "speaking-rubric-2",
  dimensions: ["Answers the question", "Development with an example", "Organization and connectives", "Vocabulary range", "Grammar", "Fluency indicators"],
  note: "Practice rubric. Not an official ETS scoring rubric.",
};

/** The current rubric for a task (items keep the version they were made with; coaching uses this one). */
export const rubricFor = (slug: PracticeSlug) => (slug === "take-interview" ? SPEAKING_RUBRIC : slug === "academic-discussion" ? DISCUSSION_RUBRIC : WRITING_RUBRIC);
