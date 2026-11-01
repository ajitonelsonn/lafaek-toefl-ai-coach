import "server-only";
import type { PracticeSlug } from "@/lib/config/practice-types";

// Versioned prompt templates. Bump PROMPT_VERSION whenever wording changes;
// it is stored with every generated item and job for auditability.
export const PROMPT_VERSION = "gen-2026-11-01.1";

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

// Formats follow the TOEFL iBT from January 2026 (lengths, question counts and question types checked
// against published practice tests); the content itself is always original.
const TASK_INSTRUCTIONS: Record<PracticeSlug, string | ((ctx: PromptContext) => string)> = {
  "complete-the-words":
    "Write one coherent academic paragraph of 70–90 words in 4–6 sentences, like the opening of a textbook section (science, history, society or technology). The first sentence introduces the topic in 10–20 words. Write PLAIN text with no brackets or blanks: the app removes the second half of every other word from the second sentence on, so sentences 2–3 must use common, predictable words (no names, numbers, abbreviations or rare terms there). Put the full paragraph in 'passage'.",
  "read-in-daily-life": (ctx) =>
    ctx.itemIndex % 2 === 0
      ? "Write one SHORT everyday text of 40–70 words: a brief email (with subject, from, to, a greeting, 3–4 sentences and a sign-off) or a short notice. Then write exactly 2 multiple-choice questions, e.g. what the reader must do, a detail, or 'What can be inferred about…'. Fill unused document fields with null or empty arrays."
      : "Write one LONGER everyday text of 120–180 words: an email, an announcement (as a notice with a heading) or a text chain of 4–6 short messages between 2–4 people with times like '9:05 A.M.'. Then write exactly 3 multiple-choice questions from these types: main purpose ('What is the main purpose of…' / 'What is X's main concern?'), a detail ('According to…'), an inference ('What can be inferred about…'), and NOT/EXCEPT ('Which of the following is NOT mentioned…'). Fill unused document fields with null or empty arrays.",
  "read-academic-passage":
    "Write one original academic passage with a title, 3–4 paragraphs and 200–280 words in total, in the style of an introductory university textbook. Then write exactly 5 questions in passage order, using: one vocabulary question ('The word \"X\" in the passage is closest in meaning to'), one detail question ('According to the passage, …'), one 'Why does the author mention …?' question, one inference question ('What can be inferred about …?'), and one of: 'What is the relationship between paragraphs 2 and 3?', 'All of the following are mentioned … EXCEPT', or 'Which sentence in paragraph N explains …?' (options are four sentences quoted exactly from that paragraph). Set each question's type accordingly.",
  "listen-choose-response":
    "Set 'speakerGender' ('female' or 'male') for the person who says the line. Write one short spoken line (5–15 words) from everyday, work or campus life, and four short written replies where exactly one is the most natural response. Use one of these line types: a wh-question, a yes/no question, a negative question ('Didn't you…?'), a request or offer ('Could you…?' / 'Would you like…?'), or a statement that expects a reaction ('The meeting is running late.'). Wrong replies should be plausible traps: they repeat a word from the line, answer a different question, or use the wrong time or person. In the explanation, refer to replies by their words, never by letter or position.",
  "listen-conversation":
    "Give each speaker a 'gender' ('female' or 'male') and a name that fits it; the voices are chosen from it, and the imagePrompt must show exactly these people with these genders (e.g. 'a young woman student talking with a male librarian'). Write a short, natural conversation of 4–7 turns (80–130 words in total) between two people in everyday life (friends, roommates, coworkers, or a student and staff member) about a small problem or plan. Use speaker ids S1 and S2. Then write exactly 2 questions, e.g. a reason or detail ('Why did the man…?', 'What does the woman advise…?'), 'Why does the man mention…?', or 'What will happen tomorrow?'. imagePrompt: a short description of the scene for an illustration, no text in the image.",
  "listen-announcement":
    "Give the speaker a 'gender' ('female' or 'male'); if the imagePrompt shows the speaker, use that gender. Write one short spoken announcement of 45–90 words (3–5 sentences) read by one speaker (speaker id S1), split into 1–3 script lines. Set 'title' to its context, e.g. 'Announcement at a university club meeting', '… at a campus event', '… from the university library' or '… at a housing meeting'. It gives practical information (what, when, where) and asks listeners to do something. Then write exactly 2 questions: the main purpose, and what listeners should do, a detail, or 'Why does the speaker mention…?'. imagePrompt: a short scene description, no text in the image.",
  "listen-academic-talk":
    "Give the professor a 'gender' ('female' or 'male'); if the imagePrompt shows the professor, use that gender. Write an original talk in a university class of 230–300 words by one professor (speaker id S1), in 3 parts (script lines): introduce the topic, explain it with examples or evidence, then a wider point. Set 'title' to 'Talk in a <subject> class'. Then write exactly 4 questions from these types: 'What is the main topic of the talk?', 'Why does the speaker mention…?', 'According to the speaker, …', 'What can be inferred about…?', '… are mentioned EXCEPT', and 'What will the speaker most likely discuss next?'. imagePrompt: a short description of a simple illustration of the topic, no text in the image.",
  "build-sentence": [
    "Write a two-person exchange: 'context' is what the first person says; the reply is built by the learner from 5–6 word groups in 'tokens' (in the CORRECT order, lowercase except proper nouns and 'I'). Put fixed words before the tokens in 'prefix' (or null) and fixed ending words plus final punctuation in 'suffix'. 'parts' labels the reply's grammatical parts.",
    "The correct order must be the ONLY grammatical order. Follow these rules, which prevent the most common mistakes:",
    "1. The reply answers EXACTLY what the first person asked (if they ask how X helps Y, the reply says how X helps Y), and the pronouns fit who is speaking (the reply is the second person's words: 'your' for the first person's things, 'my' for the second person's).",
    "2. Never make any prepositional phrase its own group: not time, place, frequency or purpose phrases ('for lunch', 'on weekends', 'for years', 'near the library', 'for my flight') and not 'of/with/from/into/about + noun' phrases ('of the rock club', 'with my friend'). Keep each one in the same group as the word it belongs to, or put it in the fixed suffix.",
    "3. Never make a movable adverb its own group or start a group with one (also, really, usually, often, just, still, maybe).",
    "4. Do not use words that could be left out, such as an optional 'that' after know, think, say or hope; join such a word to the start of its clause in the same group.",
    "5. Lock every group into one place: start groups with a verb, 'to + verb', a question word or clause word (where, when, why, how, whether, if, who, which) joined to what follows, or a preposition joined to its noun. Use subject–verb agreement (singular vs plural) so swapped nouns would be ungrammatical.",
    "6. Keep the reply SHORT and everyday, like the real test: 7–12 words in total, one main clause plus at most one embedded clause (indirect question, relative clause or reported speech). Each group has 1–3 words.",
    "7. No time, place, frequency, manner or purpose phrase anywhere in the groups (no 'during the summer', 'near campus', 'every morning', 'to save money'). If the reply needs one, put it in the fixed suffix. Never chain two modifying phrases or clauses.",
    "8. Before answering, try other orders of the groups. If any other order is also grammatical, or the reply does not answer the first person, change the groups until only one order works.",
    "Good examples (groups in brackets): A: 'The new café on campus is always busy.' B: [do you] [know] [when] [it] [opens] + suffix 'in the morning?'. A: 'Mia finished her art project early.' B: [did she] [say] [which part] [took] [the longest] + suffix '?'. A: 'Why did you leave the meeting early?' B: prefix 'I' + [had] [to pick up] [my sister] + suffix 'from school.'.",
  ].join(" "),
  "write-email":
    "Write a realistic Write an Email task (7 minutes on the test; a good answer has 100–150 words): a scenario of 60–100 words in the second person ('You recently…') that explains the situation and who to write to, the recipient (a name or role such as 'Customer Service'), a subject line, and exactly 3 things the email must do, each starting with a verb (e.g. 'Describe…', 'Explain…', 'Ask…'). Add 3–4 short tips (polite opening and closing, cover every point, use could/would for requests). imagePrompt: a short scene description for an illustration, no text in the image, or null.",
  "academic-discussion":
    "Write a Write for an Academic Discussion task (10 minutes on the test; a good answer has at least 100 words): a course topic, a fictional professor (title and surname) whose post of 80–130 words introduces an issue and ends with a direct question, and two fictional students' posts of 50–80 words each that take different positions with a reason and a personal example. Add 3–4 tips (state an opinion, give a reason and an example, add a new idea rather than repeating the students).",
  "listen-repeat":
    "Write a situation in the second person, e.g. 'You are welcoming new employees to the office kitchen. Listen to the speaker and repeat what they say.', and exactly 7 natural sentences that the speaker in that situation (a trainer, guide or supervisor) says, getting gradually longer from about 6 to about 18 words (never more than 20). Use clear, everyday instructions and descriptions. imagePrompt: a short description of a simple illustration of the situation, no text, or null.",
  "take-interview":
    "Write a Take an Interview task. Scenario: 'You have agreed to participate in a research study about <topic>. You will have a short online interview with a researcher. The researcher will ask you some questions.' Topics are habits, study, education, work, teamwork, technology, health or the environment. Then write exactly 4 questions the researcher speaks (25–60 words each), each starting with a natural lead-in: 1) 'Thanks for joining me today. To begin, …' about the learner's own habits or experience, offering options ('For instance, do you … or …?'); 2) a short reaction ('I see.') and a preference between two choices, ending 'Please explain.'; 3) 'Interesting. Next, I'd like to get your opinion.' about a trend and whether it will continue in the future, 'Why or why not?'; 4) 'One last question: some people say …, while others argue … What do you think, and why?' about the wider society.",
};

export function buildUserPrompt(slug: PracticeSlug, ctx: PromptContext): string {
  const topic = suggestedTopic(slug, ctx.itemIndex, ctx.avoidTopics);
  const instruction = TASK_INSTRUCTIONS[slug];
  return [
    `Task type: ${slug}.`,
    typeof instruction === "function" ? instruction(ctx) : instruction,
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
    "Mix them: wh-questions, yes/no questions, negative questions, requests or offers, and statements that expect a reaction; all four speaker roles (student, staff, professor, friend); and different kinds of correct reply (answering, agreeing, suggesting, declining, asking back). Every spoken line must be new: never reuse a situation or line from another item or from the topics already used.",
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
