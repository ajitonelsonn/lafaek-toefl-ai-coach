"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import { SCORE_BANDS, cefrForBand, formatBand, isScoreBand } from "@/lib/config/toefl-scale";
import type { EnglishLevel, StudyEmphasis, Weekday } from "@/lib/services/types";
import type { StudyPlanInputBody as StudyPlanInput } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { todayKey } from "@/lib/utils/dates";

/** Local YYYY-MM-DD `n` days from today. */
const localDay = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayKey(d);
};
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${todayKey()}T12:00:00Z`)) / 86_400_000);

export const LEVEL_OPTIONS: { value: EnglishLevel; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "I understand simple, everyday English." },
  { value: "intermediate", label: "Intermediate", hint: "I can follow most conversations and short texts." },
  { value: "upper-intermediate", label: "Upper intermediate", hint: "I can read and listen to longer academic texts." },
  { value: "advanced", label: "Advanced", hint: "I am comfortable with complex academic English." },
];

export const EMPHASIS_OPTIONS: { value: StudyEmphasis; label: string }[] = [
  { value: "balanced", label: "Balanced — all four skills" },
  { value: "weak-areas", label: "Focus on my weakest areas" },
  { value: "test-strategy", label: "Test strategy and timing" },
  { value: "vocabulary", label: "More vocabulary practice" },
];

export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const STEPS = ["Your goal", "Your schedule", "Your focus", "Review"];

export const DEFAULT_INPUT: StudyPlanInput = {
  level: "intermediate",
  targetScore: 4,
  testDate: null,
  dailyMinutes: 30,
  studyDays: ["mon", "tue", "wed", "thu", "fri"],
  weakAreas: [],
  emphasis: "balanced",
  accents: ["en-US", "en-GB"],
  goals: "",
};

const ACCENT_OPTIONS: { value: StudyPlanInput["accents"][number]; label: string }[] = [
  { value: "en-US", label: "American English" },
  { value: "en-GB", label: "British English" },
  { value: "en-AU", label: "Australian English" },
  { value: "en-IN", label: "Indian English" },
];

type Errors = Partial<Record<"targetScore" | "testDate" | "studyDays", string>>;

function validateStep(step: number, v: StudyPlanInput): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!isScoreBand(v.targetScore)) e.targetScore = "Choose a target score from 1 to 6.";
    if (v.testDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.testDate) || v.testDate < todayKey()) e.testDate = "Choose today or a later date, or leave it empty.";
      else if (v.testDate > localDay(366)) e.testDate = "Choose a test date within one year.";
    }
  }
  if (step === 1 && v.studyDays.length === 0) e.studyDays = "Choose at least one study day.";
  return e;
}

interface WizardProps {
  initial?: StudyPlanInput;
  onFinish: (input: StudyPlanInput) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export function StudyPlanWizard({ initial = DEFAULT_INPUT, onFinish, onCancel, saving }: WizardProps) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<StudyPlanInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof StudyPlanInput>(k: K, value: StudyPlanInput[K]) => setV((p) => ({ ...p, [k]: value }));

  const next = () => {
    const e = validateStep(step, v);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => s + 1);
  };

  const toggle = <T extends string>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <section aria-labelledby="wizard-title" className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <div className="border-b border-line p-5 sm:p-6">
        <h2 id="wizard-title" className="text-xl font-bold text-ink">
          Create your study plan
        </h2>
        <p className="mt-1 text-sm text-muted">Answer a few short questions. You can change everything later.</p>
        <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-line")} aria-hidden />
              <span className={cn("text-xs font-semibold sm:text-sm", i === step ? "text-primary" : "text-muted")} aria-current={i === step ? "step" : undefined}>
                <span className="sr-only">Step {i + 1}: </span>
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-5 sm:p-6">
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-ink">What is your English level now?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {LEVEL_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border p-4 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/40",
                      v.level === o.value ? "border-primary bg-primary-soft" : "border-line hover:border-primary/60",
                    )}
                  >
                    <input type="radio" name="level" value={o.value} checked={v.level === o.value} onChange={() => set("level", o.value)} className="mt-1 size-4 accent-[var(--primary)]" />
                    <span>
                      <span className="block font-semibold text-ink">{o.label}</span>
                      <span className="text-sm text-muted">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Select
                  label="Target TOEFL score (1–6)"
                  value={String(v.targetScore)}
                  onChange={(e) => set("targetScore", Number(e.target.value))}
                  options={[...SCORE_BANDS].reverse().map((b) => ({ value: String(b), label: `${formatBand(b)} of 6 · CEFR ${cefrForBand(b)}` }))}
                  error={errors.targetScore}
                  hint="TOEFL iBT 2026 scale. Common goals: 3.5 (B1), 4.5 (B2), 5.0 (C1)."
                />
                <div className="mt-2 flex gap-2">
                  {[3.5, 4.5, 5].map((n) => (
                    <button key={n} type="button" onClick={() => set("targetScore", n)} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", v.targetScore === n ? "border-primary bg-primary text-on-primary" : "border-line text-body hover:border-primary")}>
                      {formatBand(n)}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Test date (optional)"
                type="date"
                min={localDay(0)}
                max={localDay(366)}
                value={v.testDate ?? ""}
                onChange={(e) => set("testDate", e.target.value || null)}
                error={errors.testDate}
                hint={
                  v.testDate && !errors.testDate && /^\d{4}-\d{2}-\d{2}$/.test(v.testDate)
                    ? `${daysUntil(v.testDate)} days from today. We will plan every study day until then.`
                    : "We count the days and plan every study day until your test. Leave empty if it is not booked yet."
                }
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <Select
              label="How much time can you study each day?"
              value={String(v.dailyMinutes)}
              onChange={(e) => set("dailyMinutes", Number(e.target.value))}
              options={[15, 30, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} minutes` }))}
              containerClassName="max-w-sm"
            />
            <fieldset aria-describedby={errors.studyDays ? "days-error" : undefined}>
              <legend className="mb-3 text-sm font-semibold text-ink">Which days can you study?</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((d) => {
                  const on = v.studyDays.includes(d.value);
                  return (
                    <button key={d.value} type="button" aria-pressed={on} onClick={() => set("studyDays", toggle(v.studyDays, d.value))} className={cn("min-w-16 rounded-xl border px-4 py-2.5 text-sm font-semibold", on ? "border-primary bg-primary text-on-primary" : "border-line text-body hover:border-primary")}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {errors.studyDays && (
                <p id="days-error" className="mt-2 text-sm text-danger" role="alert">
                  {errors.studyDays}
                </p>
              )}
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-ink">Which skills feel hardest for you?</legend>
              <p className="mb-3 text-sm text-muted">Choose any. Leave all empty if you are not sure.</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {SKILLS.map((s) => {
                  const on = v.weakAreas.includes(s.id);
                  return (
                    <label key={s.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4 font-semibold has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/40", on ? "border-primary bg-primary-soft text-primary" : "border-line text-ink hover:border-primary/60")}>
                      <input type="checkbox" checked={on} onChange={() => set("weakAreas", toggle<SkillId>(v.weakAreas, s.id))} className="size-4 accent-[var(--primary)]" />
                      {s.title}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Select label="What should your plan focus on?" value={v.emphasis} onChange={(e) => set("emphasis", e.target.value as StudyEmphasis)} options={EMPHASIS_OPTIONS} containerClassName="max-w-md" />
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-ink">Which English accents would you like to hear in listening practice?</legend>
              <p className="mb-3 text-sm text-muted">We use these when choosing voices. Available accents depend on the voices our audio provider offers.</p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map((a) => {
                  const on = v.accents.includes(a.value);
                  return (
                    <button key={a.value} type="button" aria-pressed={on} onClick={() => set("accents", toggle(v.accents, a.value))} className={cn("rounded-xl border px-4 py-2.5 text-sm font-semibold", on ? "border-primary bg-primary text-on-primary" : "border-line text-body hover:border-primary")}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Textarea label="Your goal (optional)" hint="For example: “University admission in the UK”. Up to 300 characters." maxLength={300} className="min-h-20" value={v.goals} onChange={(e) => set("goals", e.target.value)} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="mb-3 font-bold text-ink">Check your answers</h3>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {[
                ["English level", LEVEL_OPTIONS.find((o) => o.value === v.level)?.label, 0],
                ["Target score", `${formatBand(v.targetScore)} of 6 (CEFR ${cefrForBand(v.targetScore)})`, 0],
                ["Test date", v.testDate ? `${new Date(`${v.testDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · ${daysUntil(v.testDate)} days away` : "Not set", 0],
                ["Daily study time", `${v.dailyMinutes} minutes`, 1],
                ["Study days", v.studyDays.map((d) => WEEKDAY_OPTIONS.find((w) => w.value === d)?.label).join(", "), 1],
                ["Weakest areas", v.weakAreas.length ? v.weakAreas.map((w) => SKILLS.find((s) => s.id === w)?.title).join(", ") : "Not sure", 2],
                ["Plan focus", EMPHASIS_OPTIONS.find((o) => o.value === v.emphasis)?.label, 2],
                ["Accents", v.accents.length ? v.accents.map((a) => ACCENT_OPTIONS.find((o) => o.value === a)?.label).join(", ") : "Any", 2],
                ["Goal", v.goals || "Not set", 2],
              ].map(([label, value, s]) => (
                <div key={label as string} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <dt className="text-muted">{label}</dt>
                  <dd className="flex items-center gap-3 font-semibold text-ink">
                    {value}
                    <button type="button" onClick={() => setStep(s as number)} className="text-xs font-semibold text-primary hover:underline">
                      Edit<span className="sr-only"> {label}</span>
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex gap-2 rounded-xl bg-primary-soft/70 p-3 text-sm text-body">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              When you finish, we save your plan and start creating personalised practice questions with AI in the background. This takes a few
              minutes; you can use the starter questions right away and leave this page at any time.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5 sm:p-6">
        <div className="flex gap-3">
          {step > 0 ? (
            <Button variant="secondary" leftIcon={<ArrowLeft className="size-4" />} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            onCancel && (
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )
          )}
        </div>
        {step < STEPS.length - 1 ? (
          <Button rightIcon={<ArrowRight className="size-4" />} onClick={next}>
            Continue
          </Button>
        ) : (
          <Button rightIcon={<Check className="size-4" />} onClick={() => onFinish(v)} loading={saving}>
            Finish
          </Button>
        )}
      </div>
    </section>
  );
}
