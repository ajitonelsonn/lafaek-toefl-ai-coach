// Request schemas shared by API routes and forms. No secrets here.
import { z } from "zod";

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
export const accentSchema = z.enum(["en-US", "en-GB", "en-AU", "en-IN"]);

export const studyPlanInputSchema = z.object({
  level: z.enum(["beginner", "intermediate", "upper-intermediate", "advanced"]),
  targetScore: z.number().int().min(1).max(120),
  testDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  dailyMinutes: z.number().int().refine((m) => [15, 30, 45, 60, 90].includes(m), "Choose a listed time."),
  studyDays: z.array(weekdaySchema).min(1, "Choose at least one study day.").max(7),
  weakAreas: z.array(skillSchema).max(4),
  emphasis: z.enum(["balanced", "weak-areas", "test-strategy", "vocabulary"]),
  accents: z.array(accentSchema).max(4).default(["en-US", "en-GB"]),
  goals: z.string().trim().max(300).default(""),
});

export type StudyPlanInputBody = z.infer<typeof studyPlanInputSchema>;
