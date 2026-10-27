import { describe, expect, it } from "vitest";
import { buildStudyPlan, daysBetween, planCalendar, ruleWeeks, weekdayOf } from "@/lib/server/study-plan-builder";
import { mergeOutline } from "@/lib/server/generation/study-schedule";
import type { StudyPlanInput } from "@/lib/services/types";

const NOW = new Date("2026-10-28T09:00:00Z"); // a Wednesday
const base: StudyPlanInput & { startDate: string } = {
  level: "intermediate",
  targetScore: 4.5,
  testDate: null,
  dailyMinutes: 30,
  studyDays: ["mon", "wed", "fri"],
  weakAreas: ["speaking"],
  emphasis: "balanced",
  startDate: "2026-10-28",
};

describe("dated study plan", () => {
  it("counts the days to a Sunday test and schedules only the chosen weekdays", () => {
    const plan = buildStudyPlan({ ...base, testDate: "2026-11-15" }, NOW); // Sunday, 18 days away
    expect(weekdayOf("2026-11-15")).toBe("sun");
    expect(plan.daysUntilTest).toBe(18);
    expect(plan.startDate).toBe("2026-10-28");
    expect(plan.endDate).toBe("2026-11-15");
    const days = plan.schedule!;
    expect(days.at(-1)).toMatchObject({ date: "2026-11-15", type: "test" });
    const study = days.filter((d) => d.type !== "test");
    expect(study.every((d) => ["mon", "wed", "fri"].includes(d.weekday))).toBe(true);
    expect(study.every((d) => d.date >= "2026-10-28" && d.date < "2026-11-15")).toBe(true);
    // Mon/Wed/Fri from Wed 28 Oct to Sat 14 Nov = 8 study days.
    expect(study).toHaveLength(8);
    // The last study day (Fri 13 Nov) is a light review; one mock test 3+ days before the test.
    expect(study.at(-1)).toMatchObject({ date: "2026-11-13", type: "final-review" });
    const mock = study.filter((d) => d.type === "mock-test");
    expect(mock).toHaveLength(1);
    expect(daysBetween(mock[0].date, "2026-11-15")).toBeGreaterThanOrEqual(3);
  });

  it("keeps ordinary study days within the daily time budget and favours weak skills", () => {
    const plan = buildStudyPlan({ ...base, testDate: "2027-02-28" }, NOW);
    const study = plan.schedule!.filter((d) => d.type === "study");
    expect(study.every((d) => d.minutes <= 30)).toBe(true);
    expect(study.every((d) => d.tasks.some((t) => t.kind === "vocabulary"))).toBe(true);
    const speaking = study.flatMap((d) => d.tasks).filter((t) => t.slug === "listen-repeat" || t.slug === "take-interview");
    expect(speaking.length).toBeGreaterThan(0);
  });

  it("handles a test tomorrow and a test today", () => {
    const tomorrow = buildStudyPlan({ ...base, testDate: "2026-10-29", studyDays: ["sat"] }, NOW);
    // Today is not a chosen weekday, but with the test tomorrow the learner still gets today.
    expect(tomorrow.schedule!.map((d) => [d.date, d.type])).toEqual([
      ["2026-10-28", "study"],
      ["2026-10-29", "test"],
    ]);
    const today = buildStudyPlan({ ...base, testDate: "2026-10-28" }, NOW);
    expect(today.schedule!.map((d) => d.type)).toEqual(["test"]);
  });

  it("uses a level-based length without a test date, and supports a full year", () => {
    const noDate = buildStudyPlan(base, NOW);
    expect(noDate.daysUntilTest).toBeNull();
    expect(noDate.totalWeeks).toBe(10);
    expect(noDate.schedule!.some((d) => d.type === "test")).toBe(false);
    const year = buildStudyPlan({ ...base, testDate: "2027-10-27" }, NOW);
    expect(year.daysUntilTest).toBe(364);
    expect(year.weeks!.length).toBe(53);
    expect(year.schedule!.filter((d) => d.type === "mock-test").length).toBeGreaterThan(10);
  });

  it("rejects test dates in the past or more than a year away", () => {
    expect(() => buildStudyPlan({ ...base, testDate: "2026-10-20" }, NOW)).toThrow(/past/);
    expect(() => buildStudyPlan({ ...base, testDate: "2028-01-01" }, NOW)).toThrow(/one year/);
  });

  it("ignores a client start date more than a day away from the server date", () => {
    expect(buildStudyPlan({ ...base, startDate: "2026-10-29" }, NOW).startDate).toBe("2026-10-29");
    expect(buildStudyPlan({ ...base, startDate: "2027-01-01" }, NOW).startDate).toBe("2026-10-28");
  });

  it("merges an AI outline only where it fits the calendar", () => {
    const input = { ...base, testDate: "2026-11-15" };
    const cal = planCalendar(input, "2026-10-28");
    const rules = ruleWeeks(input, cal);
    const merged = mergeOutline(cal, rules, [
      { week: 1, theme: "Warm up", focusSkills: ["reading"], priorityTasks: ["complete-the-words", "build-sentence"], mockTestDate: "2026-10-31", tip: "Start slowly and steadily." }, // Saturday: not a study day
      { week: 3, theme: "Final push", focusSkills: ["speaking"], priorityTasks: ["take-interview", "listen-repeat"], mockTestDate: "2026-11-13", tip: "Rest the day before." }, // final-review day
    ]);
    expect(merged[0]).toMatchObject({ theme: "Warm up", mockTestDate: rules[0].mockTestDate });
    expect(merged[1]).toEqual(rules[1]); // no proposal for week 2: rule week kept
    expect(merged[2]).toMatchObject({ theme: "Final push", mockTestDate: rules[2].mockTestDate });
  });
});
