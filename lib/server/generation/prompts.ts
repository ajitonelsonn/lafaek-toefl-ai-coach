import "server-only";
import type { PracticeSlug } from "@/lib/config/practice-types";

// Versioned prompt templates. Bump PROMPT_VERSION whenever wording changes;
// it is stored with every generated item and job for auditability.
export const PROMPT_VERSION = "gen-2026-10-28.2";

export const SYSTEM_PROMPT = `You write ORIGINAL English practice material for adult learners preparing for the TOEFL iBT (format from January 2026).
Rules:
- Create new, original content. Never reproduce or paraphrase official ETS tests or third-party prep books.
- Use fictional people, places and organisations. No real people, brands or personal data.
- Content must be appropriate for all ages, culturally neutral and factually sound.
- Objective questions must have exactly one defensible correct answer; distractors must be clearly wrong but plausible.
- Every explanation must be supported by the text or script.
- Never claim official ETS endorsement or exact score equivalence.
- Return only JSON that matches the provided schema. No Markdown.`;

export interface PromptContext {
  cefrLevel: string;
  itemIndex: number;
  weakAreas: string[];
  goals: string;
  avoidTopics: string[];
}

const TOPIC_POOL = [
  "campus life", "biology", "astronomy", "history", "art and design", "environmental science", "psychology", "economics",
  "technology", "health", "geology", "music", "urban planning", "marine life", "education", "food and nutrition",
  "travel", "sports", "community services", "linguistics", "architecture", "climate", "anthropology", "business",
];

function suggestedTopic(slug: string, index: number, avoid: string[]): string {
  let seed = index * 7;
  for (const ch of slug) seed += ch.charCodeAt(0);
  const pool = TOPIC_POOL.filter((t) => !avoid.includes(t));
  return (pool.length ? pool : TOPIC_POOL)[seed % (pool.length || TOPIC_POOL.length)];
}

const TASK_INSTRUCTIONS: Record<PracticeSlug, string> = {
  "complete-the-words":
    "Write one coherent academic paragraph (70–110 words). In it, mark exactly 10 words as C-test blanks: keep the first half of the word and put the missing second half in square brackets, e.g. 'sen[sing]', 'i[n]'. Only mark one word per blank, missing part 1–6 letters, and choose words whose missing letters are unambiguous from context. The first sentence must have no blanks.",
  "read-in-daily-life":
    "Write one short everyday text a student might read (email, notice, or group chat) of 90–170 words, and 2–3 multiple-choice questions (purpose, detail, inference). Fill unused document fields with null or empty arrays.",
  "read-academic-passage":
    "Write one original academic passage of 3–4 paragraphs (each 60–110 words) and 5 questions covering main idea, detail, inference, vocabulary in context and purpose/organization.",
  "listen-choose-response":
    "Write one short spoken statement or question (5–20 words) from everyday or campus life, and four written responses where exactly one is the most natural reply. Distractors should repeat words or misread the intent. In the explanation, refer to replies by their words, never by letter or position.",
  "listen-conversation":
    "Write a natural conversation (8–12 turns) between two speakers (e.g. a student and a staff member) and 3–4 questions about what was said and implied. Use speaker ids S1 and S2. imagePrompt: a short description of the scene for an illustration, no text in the image.",
  "listen-announcement":
    "Write one campus or academic announcement (90–150 words) read by one announcer (speaker id S1), split into 2–4 script lines, and 3 questions. imagePrompt: a short scene description, no text in the image.",
  "listen-academic-talk":
    "Write an original mini-lecture (220–320 words) by one lecturer (speaker id S1) with clear structure and consistent terminology, split into 3–6 script lines, and 4–5 questions. imagePrompt: a short description of a simple illustration of the topic, no text in the image.",
  "build-sentence": [
    "Write a two-person exchange: 'context' is what the first person says; the reply is built by the learner from 5–6 word groups in 'tokens' (in the CORRECT order, lowercase except proper nouns and 'I'). Put fixed words before the tokens in 'prefix' (or null) and fixed ending words plus final punctuation in 'suffix'. 'parts' labels the reply's grammatical parts.",
    "The correct order must be the ONLY grammatical order. Follow these rules, which prevent the most common mistakes:",
    "1. The reply answers EXACTLY what the first person asked (if they ask how X helps Y, the reply says how X helps Y), and the pronouns fit who is speaking (the reply is the second person's words: 'your' for the first person's things, 'my' for the second person's).",
    "2. Never make any prepositional phrase its own group: not time, place, frequency or purpose phrases ('for lunch', 'on weekends', 'for years', 'near the library', 'for my flight') and not 'of/with/from/into/about + noun' phrases ('of the rock club', 'with my friend'). Keep each one in the same group as the word it belongs to, or put it in the fixed suffix.",
    "3. Never make a movable adverb its own group or start a group with one (also, really, usually, often, just, still, maybe).",
    "4. Do not use words that could be left out, such as an optional 'that' after know, think, say or hope; join such a word to the start of its clause in the same group.",
    "5. Lock every group into one place: start groups with a verb, 'to + verb', a question word or clause word (where, when, why, how, whether, if, who, which) joined to what follows, or a preposition joined to its noun. Use subject–verb agreement (singular vs plural) so swapped nouns would be ungrammatical.",
    "6. Use one main clause plus one embedded clause (indirect question, relative clause or reported speech). Each group has 2–4 words.",
    "7. Before answering, try other orders of the groups. If any other order is also grammatical, or the reply does not answer the first person, change the groups until only one order works.",
  ].join(" "),
  "write-email":
    "Write a realistic email-writing task: a scenario (90–140 words) that tells the learner who to write to and why, the recipient's name, a subject line, exactly 3 things the email must do, and 3–4 short tips. imagePrompt: a short scene description for an illustration, no text in the image, or null.",
  "academic-discussion":
    "Write an academic discussion-board task: a course topic, a fictional professor (title and surname) and their question (90–150 words), and two fictional students' posts (50–90 words each) with different views. Add 3–4 tips.",
  "listen-repeat":
    "Write a workplace or campus situation (one or two sentences) and exactly 7 short, natural sentences someone in that situation might say, getting slightly longer (from about 5 to about 14 words). imagePrompt: a short description of a simple illustration of the situation, no text, or null.",
  "take-interview":
    "Write an interview scenario (a research study or survey the learner joins) and exactly 4 interview questions: personal experience, opinion with reasons, a comparison, and a broader issue.",
};

export function buildUserPrompt(slug: PracticeSlug, ctx: PromptContext): string {
  const topic = suggestedTopic(slug, ctx.itemIndex, ctx.avoidTopics);
  return [
    `Task type: ${slug}.`,
    TASK_INSTRUCTIONS[slug],
    `Learner level: CEFR ${ctx.cefrLevel}. Match vocabulary and sentence length to this level.`,
    `Suggested topic area: ${topic}.`,
    ctx.avoidTopics.length ? `Avoid these topics already used: ${ctx.avoidTopics.slice(-8).join("; ")}.` : "",
    ctx.weakAreas.length ? `The learner wants extra help with: ${ctx.weakAreas.join(", ")}.` : "",
    ctx.goals ? `Learner goal (context only; do not quote it): ${ctx.goals.slice(0, 200)}` : "",
    `Set "topic" to a 2–5 word topic label, "cefrLevel" to the level you wrote for, and "difficulty" to easy, medium or hard.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRepairPrompt(original: string, errors: string[]): string {
  return `${original}\n\nYour previous answer was rejected for these reasons:\n- ${errors.slice(0, 8).join("\n- ")}\nWrite a corrected, complete answer.`;
}

const BATCH_VARIETY: Partial<Record<PracticeSlug, string>> = {
  "listen-choose-response":
    "Mix them: questions and statements; all four speaker roles (student, staff, professor, friend); and different kinds of correct reply (answering, agreeing, suggesting, declining, asking back). Every spoken line must be new: never reuse a situation or line from another item or from the topics already used.",
};

/** Several items of one task type in one call (each must still pass the per-item checks). */
export function batchPrompt(slug: PracticeSlug, ctx: PromptContext, count: number): string {
  // buildUserPrompt lists the last 8 topics; a batch pack has many more, so name the earlier ones too.
  const earlier = ctx.avoidTopics.slice(-40, -8);
  const areas = [...new Set(Array.from({ length: count }, (_, i) => suggestedTopic(slug, ctx.itemIndex + i * 5, ctx.avoidTopics)))];
  return [
    buildUserPrompt(slug, ctx),
    `Write ${count} different items in "items", each with a different topic and situation. Instead of one topic area, spread them over these: ${areas.join(", ")}. ${BATCH_VARIETY[slug] ?? ""}`.trim(),
    earlier.length ? `Earlier topics, also not to repeat: ${earlier.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Several Build a Sentence items in one call (each must still pass the per-item checks). */
export function buildSentenceBatchPrompt(ctx: PromptContext, count: number, toFix: { item: { context: string; prefix: string | null; tokens: string[]; suffix: string | null }; issue: string }[] = []): string {
  const fixes = toFix.slice(0, count);
  return [
    buildUserPrompt("build-sentence", ctx),
    `Write ${count} different items in "items". Use a different topic, situation and sentence pattern for each. Apply every rule above to EACH item separately, including the final check of other orders; quality matters more than speed.`,
    fixes.length
      ? `A careful checker rejected these earlier items. Start "items" with a corrected version of each (same idea; fix exactly the problem named, and re-check the rules), then add new items to reach ${count}:\n${fixes
          .map((f, i) => `${i + 1}. Person A: "${f.item.context}" / Reply groups: ${[f.item.prefix, ...f.item.tokens.map((t) => `[${t}]`), f.item.suffix].filter(Boolean).join(" ")}\n   Problem: ${f.issue.replace(/^Sentence check failed \([^)]*\):\s*/, "")}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Second-pass check for several Build a Sentence items at once (one verdict per numbered item). */
export function buildSentenceBatchCheckPrompt(items: { context: string; prefix: string | null; tokens: string[]; suffix: string | null }[]): string {
  const list = items
    .map((v, i) => `Item ${i + 1}. Person A says: "${v.context}"\nPerson B's reply, in order: ${[v.prefix, ...v.tokens.map((t) => `[${t}]`), v.suffix].filter(Boolean).join(" ")}`)
    .join("\n\n");
  return `Check each item. Two people are talking; Person B's reply is built from word groups.
${list}

For EVERY item, answer with its number "n":
1) grammatical: is the reply grammatical, natural, and a sensible response to Person A?
2) uniqueOrder: treating each [bracketed group] as a movable unit (prefix and suffix fixed), is this the ONLY grammatical order? If another order is also grammatical, it is not unique.
Give a short "issue" when either answer is false, otherwise an empty string.`;
}

export function scenePrompt(description: string): string {
  return `Friendly, clean flat vector illustration for an English-learning app: ${description}. Soft light colours, simple shapes, no text, no letters, no logos, no real people or brands.`;
}
