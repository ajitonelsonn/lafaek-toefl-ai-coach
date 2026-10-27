"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { SKILLS, type SkillId } from "@/lib/config/practice-types";
import type { EnglishLevel, StudyEmphasis, StudyPlanInput, Weekday } from "@/lib/services/types";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";

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
  targetScore: 80,
  testDate: null,
  dailyMinutes: 30,
  studyDays: ["mon", "tue", "wed", "thu", "fri"],
  weakAreas: [],
  emphasis: "balanced",
};

type Errors = Partial<Record<"targetScore" | "testDate" | "studyDays", string>>;

function validateStep(step: number, v: StudyPlanInput): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!Number.isInteger(v.targetScore) || v.targetScore < 1 || v.targetScore > 120) e.targetScore = "Enter a whole number from 1 to 120.";
    if (v.testDate) {
      const d = new Date(v.testDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(d.getTime()) || d < today) e.testDate = "Choose a date in the future, or leave it empty.";
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
                <Input
                  label="Target TOEFL score (0–120)"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  value={Number.isNaN(v.targetScore) ? "" : v.targetScore}
                  onChange={(e) => set("targetScore", e.target.value === "" ? Number.NaN : Number(e.target.value))}
                  error={errors.targetScore}
                  hint="Common goals: 60, 80, 100."
                />
                <div className="mt-2 flex gap-2">
                  {[60, 80, 100].map((n) => (
                    <button key={n} type="button" onClick={() => set("targetScore", n)} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", v.targetScore === n ? "border-primary bg-primary text-on-primary" : "border-line text-body hover:border-primary")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Test date (optional)"
                type="date"
                value={v.testDate ?? ""}
                onChange={(e) => set("testDate", e.target.value || null)}
                error={errors.testDate}
                hint="Leave empty if you have not booked a test."
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
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="mb-3 font-bold text-ink">Check your answers</h3>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {[
                ["English level", LEVEL_OPTIONS.find((o) => o.value === v.level)?.label, 0],
                ["Target score", `${v.targetScore} / 120`, 0],
                ["Test date", v.testDate ? new Date(v.testDate).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not set", 0],
                ["Daily study time", `${v.dailyMinutes} minutes`, 1],
                ["Study days", v.studyDays.map((d) => WEEKDAY_OPTIONS.find((w) => w.value === d)?.label).join(", "), 1],
                ["Weakest areas", v.weakAreas.length ? v.weakAreas.map((w) => SKILLS.find((s) => s.id === w)?.title).join(", ") : "Not sure", 2],
                ["Plan focus", EMPHASIS_OPTIONS.find((o) => o.value === v.emphasis)?.label, 2],
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
              AI content generation is not connected in this preview. Your plan is created by simple rules in your browser, and personalised practice
              generation is simulated. You can use the sample questions right away.
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
