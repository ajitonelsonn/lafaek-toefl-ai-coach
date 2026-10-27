// Converts the hand-written starter content into the generation-output format so it
// passes exactly the same validators as AI-generated content before being stored.
import type { PracticeSlug } from "../../lib/config/practice-types";
import type { ChoiceQuestion, DailyLifeDocument, PracticeContent } from "../../lib/services/types";
import { SAMPLE_SETS } from "./questions";

const LETTERS = ["A", "B", "C", "D"];
const meta = (topic: string, cefrLevel = "B1", difficulty = "medium") => ({ topic, cefrLevel, difficulty });
const q = (x: ChoiceQuestion) => ({ prompt: x.prompt, options: x.options.map((o) => o.text), answerIndex: LETTERS.indexOf(x.answerId), explanation: x.explanation });

function doc(d: DailyLifeDocument, title: string) {
  const empty = { from: null, to: null, subject: null, heading: null, body: [] as string[], signOff: null, footer: null, messages: [] as { sender: string; text: string; time: string }[] };
  if (d.type === "email") return { ...empty, type: "email", from: d.from, to: d.to, subject: d.subject, body: d.body, signOff: d.signOff };
  if (d.type === "notice") return { ...empty, type: "notice", heading: d.heading, body: d.body, footer: d.footer ?? null };
  return { ...empty, type: "chat", heading: d.title ?? title, messages: d.messages };
}

/** Splits long monologues into ≤ 600-character lines on sentence boundaries. */
function lines(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const s of text.match(/[^.!?]+[.!?]+/g) ?? [text]) {
    if ((cur + s).length > 560 && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const ROLE: Record<string, string> = { Student: "student", Librarian: "staff", Advisor: "staff" };

export interface StarterEntry {
  slug: PracticeSlug;
  index: number;
  output: Record<string, unknown>;
  extraContent?: Record<string, unknown>;
}

export function starterEntries(): StarterEntry[] {
  const out: StarterEntry[] = [];
  const push = (slug: PracticeSlug, output: Record<string, unknown>, extraContent?: Record<string, unknown>) =>
    out.push({ slug, index: out.filter((e) => e.slug === slug).length, output, extraContent });

  for (const [slug, set] of Object.entries(SAMPLE_SETS) as [PracticeSlug, PracticeContent][]) {
    switch (set.kind) {
      case "complete-the-words":
        set.items.forEach((i) => push(slug, { ...meta(i.title), title: i.title, passage: i.text }));
        break;
      case "read-in-daily-life":
        set.items.forEach((i) => push(slug, { ...meta(i.title, "B1", "easy"), title: i.title, document: doc(i.document!, i.title), questions: i.questions.map(q) }));
        break;
      case "read-academic-passage":
        set.items.forEach((i) =>
          push(slug, {
            ...meta(i.title, "B2"),
            title: i.title,
            paragraphs: i.paragraphs,
            questions: i.questions.map((x, n) => ({ ...q(x), type: ["main_idea", "detail", "inference", "vocabulary", "detail", "purpose"][n] ?? "detail" })),
          }),
        );
        break;
      case "listen-choose-response":
        set.items.forEach((i) => push(slug, { ...meta("Everyday conversation", "A2", "easy"), speakerRole: "friend", ...q(i.question), prompt: i.audio.transcript }));
        break;
      case "listen-conversation":
      case "listen-announcement":
      case "listen-academic-talk":
        set.items.forEach((i) => {
          let speakers: { id: string; role: string; name: string }[];
          let script: { speakerId: string; text: string }[];
          if (i.audio.turns?.length) {
            const names = [...new Set(i.audio.turns.map((t) => t.speaker))];
            speakers = names.map((n, k) => ({ id: `S${k + 1}`, role: ROLE[n] ?? "student", name: n }));
            script = i.audio.turns.map((t) => ({ speakerId: `S${names.indexOf(t.speaker) + 1}`, text: t.text }));
          } else {
            const role = set.kind === "listen-announcement" ? "announcer" : "lecturer";
            speakers = [{ id: "S1", role, name: role === "announcer" ? "Announcer" : "Professor" }];
            script = lines(i.audio.transcript).map((text) => ({ speakerId: "S1", text }));
          }
          push(slug, { ...meta(i.title, set.kind === "listen-academic-talk" ? "B2" : "B1"), title: i.title, speakers, script, questions: i.questions.map(q), imagePrompt: null });
        });
        break;
      case "build-sentence":
        set.items.forEach((i) =>
          push(slug, { ...meta("Indirect questions"), context: i.context, prefix: i.prefix ?? null, suffix: i.suffix ?? null, tokens: i.tokens, parts: i.parts, explanation: i.explanation }),
        );
        break;
      case "write-email":
        set.items.forEach((i) =>
          push(
            slug,
            { ...meta(i.subject ?? "Email"), scenario: i.scenario, recipient: i.recipient, subject: i.subject, bullets: i.bullets, tips: i.tips.map((t) => t[0].toUpperCase() + t.slice(1)), imagePrompt: null },
            i.illustration ? { illustration: i.illustration } : undefined,
          ),
        );
        break;
      case "academic-discussion":
        set.items.forEach((i) =>
          push(slug, {
            ...meta(i.professor!.name === "Dr. Lin" ? "Education" : "Public health", "B2"),
            courseTopic: i.professor!.name === "Dr. Lin" ? "education" : "public health",
            professorName: i.professor!.name,
            professorPrompt: i.professor!.prompt,
            students: i.students,
            tips: i.tips,
          }),
        );
        break;
      case "listen-repeat":
        push(slug, { ...meta("Office printer", "A2", "easy"), situation: set.situation, sentences: set.items.map((i) => i.audio.transcript), imagePrompt: null }, { illustration: "officePrinter" });
        break;
      case "take-interview":
        push(slug, { ...meta("Gardening", "B1"), scenario: set.scenario, questions: set.items.map((i) => i.audio.transcript) });
        break;
    }
  }
  return out;
}
