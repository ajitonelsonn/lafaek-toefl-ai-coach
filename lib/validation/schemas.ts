// Request schemas shared by API routes and forms. No secrets here.
import { z } from "zod";
import { isScoreBand } from "@/lib/config/toefl-scale";

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Please enter your email.")
  .max(254, "That email is too long.")
  .email("Please enter a valid email, like name@example.com.")
  .transform((e) => e.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and at least one number.");

export const nameSchema = z.string().trim().min(2, "Please enter at least 2 letters.").max(60, "Please use at most 60 characters.");

export const signupSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Please enter your password.").max(128) });
export const verifyEmailSchema = z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/, "Enter all 6 digits.") });
export const resendSchema = z.object({ email: emailSchema });

export const weekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const skillSchema = z.enum(["reading", "listening", "writing", "speaking"]);
export const accentSchema = z.enum(["en-US", "en-GB", "en-AU", "en-IN", "en-ZA"]);

export const studyPlanInputSchema = z.object({
  level: z.enum(["beginner", "intermediate", "upper-intermediate", "advanced"]),
  // TOEFL 2026 scale: a band from 1 to 6 in steps of 0.5 (see lib/config/toefl-scale.ts).
  targetScore: z.number().refine(isScoreBand, "Choose a target score from 1 to 6."),
  testDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  dailyMinutes: z.number().int().refine((m) => [15, 30, 45, 60, 90].includes(m), "Choose a listed time."),
  studyDays: z.array(weekdaySchema).min(1, "Choose at least one study day.").max(7),
  weakAreas: z.array(skillSchema).max(4),
  emphasis: z.enum(["balanced", "weak-areas", "test-strategy", "vocabulary"]),
  // Any of the offered accents (the limit follows the options, so adding one never breaks saving).
  accents: z.array(accentSchema).max(accentSchema.options.length, `Choose up to ${accentSchema.options.length} accents.`).default(["en-US", "en-GB"]),
  goals: z.string().trim().max(300).default(""),
  /** The learner's local "today" (YYYY-MM-DD); the server accepts it only within a day of its own date. */
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type StudyPlanInputBody = z.infer<typeof studyPlanInputSchema>;
