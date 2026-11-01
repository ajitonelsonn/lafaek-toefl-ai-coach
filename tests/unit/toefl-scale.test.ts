import { describe, expect, it } from "vitest";
import { SCORE_BANDS, cefrForBand, estimateBandFromAccuracy, isScoreBand, normaliseTarget, overallBand } from "@/lib/config/toefl-scale";
import { studyPlanInputSchema } from "@/lib/validation/schemas";

// TOEFL iBT 2026 scale: bands 1–6 in 0.5 steps; CEFR as printed on the score report.
describe("TOEFL 2026 score scale", () => {
  it("has the 11 bands from 1 to 6", () => {
    expect(SCORE_BANDS).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
    expect([0.5, 6.5, 4.25, 80].some(isScoreBand)).toBe(false);
  });

  it("maps bands to CEFR like the score report", () => {
    expect(SCORE_BANDS.map(cefrForBand)).toEqual(["A1", "A1", "A2", "A2", "B1", "B1", "B2", "B2", "C1", "C1", "C2"]);
  });

  it("averages sections to the nearest 0.5 (report: 3.0, 4.0, 1.5, 3.5 → 3.0)", () => {
    expect(overallBand([3, 4, 1.5, 3.5])).toBe(3);
  });

  it("reads old 0–120 targets as bands and keeps bands unchanged", () => {
    expect(normaliseTarget(51)).toBe(3);
    expect(normaliseTarget(100)).toBe(5);
    expect(normaliseTarget(4.5)).toBe(4.5);
  });

  it("study plan input accepts bands only", () => {
    const base = { level: "intermediate", testDate: null, dailyMinutes: 30, studyDays: ["mon"], weakAreas: [], emphasis: "balanced", accents: ["en-US"], goals: "" };
    expect(studyPlanInputSchema.safeParse({ ...base, targetScore: 4.5 }).success).toBe(true);
    expect(studyPlanInputSchema.safeParse({ ...base, targetScore: 90 }).success).toBe(false);
  });

  it("study plan input accepts every offered accent at once, including African English", () => {
    const all = ["en-US", "en-GB", "en-AU", "en-IN", "en-ZA"];
    const input = { level: "intermediate", targetScore: 4.5, testDate: null, dailyMinutes: 30, studyDays: ["mon", "wed"], weakAreas: [], emphasis: "balanced", accents: all, goals: "I want to continue my study in USA" };
    expect(studyPlanInputSchema.safeParse(input).success).toBe(true);
    expect(studyPlanInputSchema.safeParse({ ...input, accents: [...all, "en-NZ"] }).success).toBe(false);
  });

  it("turns section accuracy into a rough practice band", () => {
    expect(estimateBandFromAccuracy(5, 5)).toBe(6);
    expect(estimateBandFromAccuracy(4, 5)).toBe(5);
    expect(estimateBandFromAccuracy(3, 5)).toBe(3.5);
    expect(estimateBandFromAccuracy(0, 6)).toBe(1);
    expect(estimateBandFromAccuracy(0, 0)).toBeNull();
  });
});
