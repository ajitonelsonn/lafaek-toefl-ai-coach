import "server-only";
import { PRACTICE_TYPES, SKILLS, getPracticeType, type PracticeSlug } from "@/lib/config/practice-types";
import type { ProgressDTO, UsageDTO } from "@/lib/practice/insights-dto";
import { db } from "./db";
import { env } from "./env";
import { FEEDBACK_VERSION } from "./feedback";
import { unitIdsOf } from "./content/view";
import { repeatCorrect } from "./content/speech";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Right or wrong for an attempt; null when it is not auto-scored. Listen and Repeat answers saved before
 * they were scored (correct: null) are judged from their stored word match. */
function correctOf(a: { taskSlug: string; scoreJson: unknown }): boolean | null {
  const s = a.scoreJson as { correct?: boolean | null; similarity?: number | null } | null;
  if (typeof s?.correct === "boolean") return s.correct;
  if (a.taskSlug === "listen-repeat" && typeof s?.similarity === "number") return repeatCorrect(s.similarity);
  return null;
}

export async function getProgress(userId: string): Promise<ProgressDTO> {
  const attempts = await db.practiceAttempt.findMany({
    where: { userId, scoringVersion: { not: FEEDBACK_VERSION } },
    select: { practiceItemId: true, unitId: true, taskSlug: true, scoreJson: true, submittedAt: true, durationMs: true, practiceItem: { select: { topic: true } } },
    orderBy: { submittedAt: "desc" },
    take: 5000,
  });
  // Latest AI score per question (emails, discussion posts and interview answers).
  const rated = await db.practiceAttempt.findMany({
    where: { userId, scoringVersion: FEEDBACK_VERSION },
    select: { practiceItemId: true, unitId: true, taskSlug: true, scoreJson: true },
    orderBy: { submittedAt: "desc" },
    take: 2000,
  });
  const latestBand = new Map<string, { slug: string; band: number }>();
  for (const r of rated) {
    const band = (r.scoreJson as { band?: number } | null)?.band;
    const k = `${r.practiceItemId}:${r.unitId}`;
    if (typeof band === "number" && !latestBand.has(k)) latestBand.set(k, { slug: r.taskSlug, band });
  }
  const [items, resets] = await Promise.all([
    db.practiceItem.findMany({
      where: { archivedAt: null, validationStatus: "valid", OR: [{ source: "starter", userId: null }, { userId }] },
      select: { taskSlug: true, contentJson: true },
    }),
    db.practiceReset.findMany({ where: { userId }, select: { taskSlug: true, resetAt: true } }),
  ]);
  const resetAt = new Map(resets.map((r) => [r.taskSlug, r.resetAt]));

  // Latest attempt per unit decides correctness.
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) {
    const k = `${a.practiceItemId}:${a.unitId}`;
    if (!latest.has(k)) latest.set(k, a);
  }
  const units = [...latest.values()];
  const objective = units.filter((u) => correctOf(u) !== null);
  const correct = objective.filter((u) => correctOf(u)).length;

  const byDate = new Map<string, { c: number; n: number; total: number }>();
  for (const a of attempts) {
    const d = day(a.submittedAt);
    const e = byDate.get(d) ?? { c: 0, n: 0, total: 0 };
    const s = correctOf(a);
    e.total++;
    if (s !== null) {
      e.n++;
      if (s) e.c++;
    }
    byDate.set(d, e);
  }

  // Recent activity: one row per (item, day).
  const recentMap = new Map<string, ProgressDTO["recent"][number] & { ms: number }>();
  for (const a of attempts) {
    const k = `${a.practiceItemId}:${day(a.submittedAt)}`;
    const s = correctOf(a);
    const e = recentMap.get(k) ?? { date: a.submittedAt.toISOString(), slug: a.taskSlug as PracticeSlug, topic: a.practiceItem.topic, correct: null, total: 0, minutes: null, ms: 0 };
    e.total++;
    if (s !== null) e.correct = (e.correct ?? 0) + (s ? 1 : 0);
    e.ms = Math.max(e.ms, a.durationMs ?? 0);
    recentMap.set(k, e);
  }

  const durationMs = [...recentMap.values()].reduce((n, r) => n + r.ms, 0);
  return {
    questionsAttempted: units.length,
    objectiveAnswered: objective.length,
    objectiveCorrect: correct,
    accuracy: objective.length ? Math.round((correct / objective.length) * 100) : null,
    practiceMinutes: Math.round(durationMs / 60_000),
    typesTried: new Set(units.map((u) => u.taskSlug)).size,
    practisedDates: [...byDate.keys()],
    trend: [...byDate.entries()]
      .filter(([, v]) => v.n > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, v]) => ({ date, accuracy: Math.round((v.c / v.n) * 100), answered: v.n })),
    bySkill: SKILLS.map((s) => {
      const list = objective.filter((u) => getPracticeType(u.taskSlug)?.skill === s.id);
      const c = list.filter((u) => correctOf(u)).length;
      const bands = [...latestBand.values()].filter((b) => getPracticeType(b.slug)?.skill === s.id).map((b) => b.band);
      return {
        skill: s.id,
        accuracy: list.length ? Math.round((c / list.length) * 100) : null,
        answered: units.filter((u) => getPracticeType(u.taskSlug)?.skill === s.id).length,
        aiBand: bands.length ? Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 2) / 2 : null,
        aiRated: bands.length,
      };
    }),
    byTask: PRACTICE_TYPES.map((t) => ({
      slug: t.slug,
      attemptedUnits: units.filter((u) => u.taskSlug === t.slug).length,
      // Answered since the learner's last "Start over" for this type (what the practice page shows as done).
      doneUnits: units.filter((u) => u.taskSlug === t.slug && (!resetAt.get(t.slug) || u.submittedAt > resetAt.get(t.slug)!)).length,
      availableUnits: items.filter((i) => i.taskSlug === t.slug).reduce((n, i) => n + unitIdsOf(t.slug, i).length, 0),
      lastPractisedAt: attempts.find((a) => a.taskSlug === t.slug)?.submittedAt.toISOString() ?? null,
    })),
    recent: [...recentMap.values()].slice(0, 12).map(({ ms, ...r }) => ({ ...r, minutes: ms ? Math.max(1, Math.round(ms / 60_000)) : null })),
  };
}

export async function getUsage(userId: string, range: UsageDTO["range"]): Promise<UsageDTO> {
  const since = range === "all" ? undefined : new Date(Date.now() - (range === "7d" ? 7 : 30) * 86_400_000);
  const createdAt = since ? { gte: since } : undefined;
  const [events, jobs, items, media, attempts, mockTests, words] = await Promise.all([
    db.usageEvent.findMany({ where: { userId, createdAt }, select: { eventType: true, inputUnits: true, outputUnits: true, audioSeconds: true, imageCount: true, characterCount: true, createdAt: true } }),
    db.generationJob.groupBy({ by: ["status"], where: { userId, createdAt }, _count: { _all: true } }),
    db.practiceItem.count({ where: { userId, source: "generated", createdAt } }),
    db.mediaAsset.aggregate({ where: { userId, status: "ready", deletedAt: null, createdAt }, _count: { _all: true }, _sum: { byteSize: true } }),
    db.practiceAttempt.count({ where: { userId, submittedAt: createdAt } }),
    db.mockTestResult.count({ where: { userId, status: "completed", completedAt: createdAt } }),
    db.vocabularyWord.count({ where: { userId, createdAt } }),
  ]);
  const of = (t: string) => events.filter((e) => e.eventType === t);
  // All Meta text calls: questions, checks, coaching, vocabulary and study schedules.
  const textEvents = [...of("text_generation"), ...of("content_validation"), ...of("text_feedback"), ...of("vocabulary_generation"), ...of("plan_generation")];
  const tokensReported = textEvents.some((e) => e.inputUnits !== null);
  const sum = (list: typeof events, k: "inputUnits" | "outputUnits" | "audioSeconds" | "imageCount" | "characterCount") => list.reduce((n, e) => n + (e[k] ?? 0), 0);
  const count = (s: string[]) => jobs.filter((j) => s.includes(j.status)).reduce((n, j) => n + j._count._all, 0);

  const days = range === "7d" ? 7 : 30;
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    const key = day(d);
    return { date: key, requests: events.filter((e) => day(e.createdAt) === key).length };
  });

  return {
    range,
    text: { requests: textEvents.length, inputTokens: tokensReported ? sum(textEvents, "inputUnits") : null, outputTokens: tokensReported ? sum(textEvents, "outputUnits") : null, tokensReported },
    images: { generated: sum(of("image_generation"), "imageCount") },
    speech: { clips: of("speech_synthesis").length, characters: sum(of("speech_synthesis"), "characterCount"), estimatedSeconds: sum(of("speech_synthesis"), "audioSeconds"), isEstimate: true },
    transcription: { requests: of("transcription").length, audioSeconds: sum(of("transcription"), "audioSeconds") },
    feedback: { requests: of("text_feedback").length },
    generation: { itemsGenerated: items, jobsCompleted: count(["completed"]), jobsFailed: count(["failed", "cancelled"]), jobsPending: count(["queued", "retry_wait", "running", "validating", "storing", "blocked_configuration"]) },
    storage: { assets: media._count._all, bytes: media._sum.byteSize ?? 0 },
    practice: { attempts, mockTests },
    vocabulary: { words },
    cost: { estimated: null, note: "Cost estimates are not shown: provider prices are not configured in this app." },
    daily,
    dailyItemLimit: env().GENERATION_DAILY_USER_LIMIT ?? null,
  };
}
