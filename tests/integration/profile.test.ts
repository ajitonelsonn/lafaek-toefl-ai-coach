import { beforeEach, describe, expect, it } from "vitest";
import { getProfileOverview } from "@/lib/server/profile";
import { savePlan } from "@/lib/server/study-plan";
import { createUser, resetTestDb } from "../support/db";

beforeEach(async () => {
  await resetTestDb();
});

describe("profile overview", () => {
  it("starts empty and reflects the study plan once it is made", async () => {
    const u = await createUser("a@example.com");
    const empty = await getProfileOverview(u.id);
    expect(empty).toMatchObject({ goal: null, bestMock: null, plan: { packs: 0, planCredits: 1, mockCredits: 1 } });
    expect(empty.achievements.filter((a) => a.earned)).toEqual([]);
    expect(empty.achievements.find((a) => a.id === "streak")?.progress).toBe("0 / 7 days");

    await savePlan(u.id, { level: "intermediate", targetScore: 4.5, testDate: null, dailyMinutes: 30, studyDays: ["mon", "wed"], weakAreas: [], emphasis: "balanced", accents: ["en-US"], goals: "" }, false);
    const after = await getProfileOverview(u.id);
    expect(after.goal).toMatchObject({ targetScore: 4.5, testDate: null, studyDays: ["mon", "wed"], dailyMinutes: 30 });
    expect(after.plan).toMatchObject({ planCredits: 0, used: { studyPlans: 1 } });
    expect(after.achievements.find((a) => a.id === "plan")?.earned).toBe(true);
  });
});
