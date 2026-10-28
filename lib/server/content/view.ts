import "server-only";
import type { MediaAsset, PracticeItem } from "@prisma/client";
import type { PracticeSlug } from "@/lib/config/practice-types";
import type { AudioDTO, PracticeView } from "@/lib/practice/dto";
import { shuffleOptions } from "./choice-order";

export type ItemWithMedia = PracticeItem & { media: MediaAsset[] };
type Line = { speaker: { id: string; role: string; name: string }; text: string };
type Json = Record<string, unknown>;

/** Ready audio for a segment role, in playback order, or [] if any segment is missing. */
function audioFor(item: ItemWithMedia, role: string, lines: Line[]): AudioDTO {
  // One file per line. If a line was stored twice (e.g. a job retried after a worker restart),
  // use the newest copy instead of treating the audio as incomplete.
  const byLine = new Map<string, ItemWithMedia["media"][number]>();
  for (const m of item.media) {
    if (m.kind !== "audio" || m.status !== "ready" || !m.role.startsWith(`audio:${role}:`)) continue;
    const prev = byLine.get(m.role);
    if (!prev || new Date(m.createdAt ?? 0).getTime() > new Date(prev.createdAt ?? 0).getTime()) byLine.set(m.role, m);
  }
  const ready = [...byLine.values()].sort((a, b) => Number(a.role.split(":")[2]) - Number(b.role.split(":")[2]));
  const complete = ready.length === lines.length && lines.length > 0;
  const words = lines.map((l) => l.text).join(" ").split(/\s+/).length;
  return {
    assetIds: complete ? ready.map((m) => m.id) : [],
    provider: complete ? ready[0].provider : null,
    // The script is withheld whenever real audio exists (exam-like listening).
    script: complete ? null : lines.map((l) => ({ speaker: l.speaker.name, text: l.text })),
    estimatedSeconds: Math.max(2, Math.round(words / 2.4)),
    source: { itemId: item.id, role },
  };
}

function imageOf(item: ItemWithMedia): string | null {
  return item.media.find((m) => m.kind === "image" && m.status === "ready")?.id ?? null;
}

const base = (item: ItemWithMedia) => ({ itemId: item.id, source: item.source });

/** Builds the browser view for one task type. Answer keys are never read here. */
export function buildView(slug: PracticeSlug, items: ItemWithMedia[], drafts: Map<string, Json> = new Map()): PracticeView {
  const c = (item: ItemWithMedia) => item.contentJson as Json;
  switch (slug) {
    case "complete-the-words":
      return { kind: slug, items: items.map((i) => ({ ...base(i), title: String(c(i).title), segments: c(i).segments as never })) };
    case "read-in-daily-life":
    case "read-academic-passage":
      return {
        kind: slug,
        items: items.map((i) => ({
          ...base(i),
          title: String(c(i).title),
          document: c(i).document as never,
          paragraphs: c(i).paragraphs as never,
          questions: (c(i).questions as { id: string; prompt: string; options: { id: string; text: string }[] }[]).map((q) => ({ unitId: q.id, prompt: q.prompt, options: shuffleOptions(i.id, q.id, q.options) })),
        })),
      };
    case "listen-choose-response":
      return {
        kind: slug,
        items: items.map((i) => {
          const q = c(i).question as { id: string; prompt: string; options: { id: string; text: string }[] };
          return { ...base(i), audio: audioFor(i, "main", c(i).script as Line[]), question: { unitId: q.id, prompt: q.prompt, options: shuffleOptions(i.id, q.id, q.options) } };
        }),
      };
    case "listen-conversation":
    case "listen-announcement":
    case "listen-academic-talk":
      return {
        kind: slug,
        items: items.map((i) => ({
          ...base(i),
          title: String(c(i).title),
          scene: c(i).scene as "conversation" | "announcement" | "lecture",
          imageAssetId: imageOf(i),
          audio: audioFor(i, "main", c(i).script as Line[]),
          questions: (c(i).questions as { id: string; prompt: string; options: { id: string; text: string }[] }[]).map((q) => ({ unitId: q.id, prompt: q.prompt, options: shuffleOptions(i.id, q.id, q.options) })),
        })),
      };
    case "build-sentence":
      return {
        kind: slug,
        items: items.map((i) => ({
          ...base(i),
          unitId: "s",
          context: String(c(i).context),
          prefix: (c(i).prefix as string | null) ?? null,
          suffix: (c(i).suffix as string | null) ?? null,
          tokens: c(i).tokens as { id: string; text: string }[],
        })),
      };
    case "write-email":
    case "academic-discussion":
      return {
        kind: slug,
        items: items.map((i) => ({
          ...base(i),
          unitId: "w",
          scenario: String(c(i).scenario),
          bullets: (c(i).bullets as string[]) ?? [],
          recipient: (c(i).recipient as string) ?? null,
          subject: (c(i).subject as string) ?? null,
          minWords: Number(c(i).minWords ?? 80),
          maxWords: (c(i).maxWords as number | null) ?? null,
          professor: (c(i).professor as { name: string; prompt: string }) ?? null,
          students: (c(i).students as { name: string; text: string }[]) ?? [],
          checklist: (c(i).checklist as string[]) ?? [],
          tips: (c(i).tips as string[]) ?? [],
          imageAssetId: imageOf(i),
          illustration: (c(i).illustration as "emailHiking" | undefined) ?? null,
          draft: (drafts.get(i.id) as { body: string } | undefined) ?? null,
        })),
      };
    case "listen-repeat":
      return {
        kind: slug,
        items: items.map((i) => {
          const script = c(i).script as string[];
          return {
            ...base(i),
            situation: String(c(i).situation),
            imageAssetId: imageOf(i),
            illustration: (c(i).illustration as "officePrinter" | undefined) ?? null,
            sentences: (c(i).sentences as { id: string; responseSeconds: number }[]).map((s, n) => ({
              unitId: s.id,
              responseSeconds: s.responseSeconds,
              audio: audioFor(i, s.id, [{ speaker: { id: "S1", role: "narrator", name: "Speaker" }, text: script[n] }]),
            })),
          };
        }),
      };
    case "take-interview":
      return {
        kind: slug,
        items: items.map((i) => ({
          ...base(i),
          scenario: String(c(i).scenario),
          imageAssetId: imageOf(i),
          questions: (c(i).questions as { id: string; responseSeconds: number; text: string }[]).map((q) => ({
            unitId: q.id,
            responseSeconds: q.responseSeconds,
            audio: audioFor(i, q.id, [{ speaker: { id: "S1", role: "interviewer", name: "Interviewer" }, text: q.text }]),
          })),
        })),
      };
  }
}

/** Unit ids an item contains (used for validation of submissions and progress). */
export function unitIdsOf(slug: PracticeSlug, item: Pick<PracticeItem, "contentJson">): string[] {
  const c = item.contentJson as Json;
  switch (slug) {
    case "complete-the-words":
      return (c.segments as { type: string; unitId?: string }[]).filter((s) => s.type === "blank").map((s) => s.unitId!);
    case "listen-choose-response":
      return ["q1"];
    case "build-sentence":
      return ["s"];
    case "write-email":
    case "academic-discussion":
      return ["w"];
    case "listen-repeat":
      return (c.sentences as { id: string }[]).map((s) => s.id);
    case "take-interview":
      return (c.questions as { id: string }[]).map((q) => q.id);
    default:
      return (c.questions as { id: string }[]).map((q) => q.id);
  }
}
