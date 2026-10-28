import { describe, expect, it } from "vitest";
import { longestStreak } from "@/lib/server/profile";

describe("practice streak (On fire achievement)", () => {
  it("finds the longest run of consecutive days, ignoring order and repeats", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2026-10-20"])).toBe(1);
    expect(longestStreak(["2026-10-22", "2026-10-20", "2026-10-21", "2026-10-21", "2026-10-25"])).toBe(3);
    expect(longestStreak(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"])).toBe(4); // across a month end
  });
});
