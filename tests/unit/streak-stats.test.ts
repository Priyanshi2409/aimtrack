import { describe, expect, it } from "vitest";
import { addDays, localDate, startOfWeek } from "@/lib/core/dates";
import { computeNudges } from "@/lib/core/nudges";
import { fitToCapacity, phaseDates } from "@/lib/core/schedule";
import { activeDays, computeStreak } from "@/lib/core/streak";
import { bestWeekday, heatmap, plannedVsActual, weeklyCompletion, type StatTask } from "@/lib/core/stats";

const days = (...ds: string[]) => new Set(ds);

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const s = computeStreak(days("2026-09-26", "2026-09-27", "2026-09-28"), "2026-09-28");
    expect(s).toEqual({ current: 3, longest: 3, todayDone: true });
  });

  it("keeps the streak alive until today is over", () => {
    const s = computeStreak(days("2026-09-26", "2026-09-27"), "2026-09-28");
    expect(s.current).toBe(2);
    expect(s.todayDone).toBe(false);
  });

  it("breaks after a full missed day", () => {
    expect(computeStreak(days("2026-09-25", "2026-09-26"), "2026-09-28").current).toBe(0);
  });

  it("tracks the longest run separately", () => {
    const s = computeStreak(days("2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-27", "2026-09-28"), "2026-09-28");
    expect(s.current).toBe(2);
    expect(s.longest).toBe(4);
  });

  it("uses the user's timezone for day boundaries", () => {
    // 20:00 UTC on the 27th is 01:30 on the 28th in India
    const a = activeDays([{ status: "done", completed_at: "2026-09-27T20:00:00Z" }], "Asia/Kolkata");
    expect([...a]).toEqual(["2026-09-28"]);
    const b = activeDays([{ status: "pending", completed_at: null }], "Asia/Kolkata");
    expect(b.size).toBe(0);
  });

  it("handles month and year boundaries", () => {
    expect(computeStreak(days("2026-12-31", "2027-01-01"), "2027-01-01").current).toBe(2);
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

const st = (o: Partial<StatTask>): StatTask => ({
  goal_id: "g",
  status: "pending",
  scheduled_date: "2026-09-28",
  original_date: "2026-09-28",
  estimated_minutes: 30,
  actual_minutes: null,
  completed_at: null,
  ...o,
});

describe("stats", () => {
  it("weekly completion is based on the original plan (replans can't hide misses)", () => {
    const tasks = [
      st({ original_date: "2026-09-21", scheduled_date: "2026-09-21", status: "done", completed_at: "2026-09-21T10:00:00Z" }),
      st({ original_date: "2026-09-22", scheduled_date: "2026-09-29", status: "pending" }), // missed and moved
    ];
    const w = weeklyCompletion(tasks, "2026-09-28", 2);
    expect(w[0]).toMatchObject({ week_start: "2026-09-21", planned: 2, done: 1, rate: 0.5 });
    expect(w[1].week_start).toBe("2026-09-28");
  });

  it("skipped tasks count as planned-but-not-done", () => {
    const w = weeklyCompletion([st({ original_date: "2026-09-22", status: "skipped" }), st({ original_date: "2026-09-22", status: "done", completed_at: "2026-09-22T05:00:00Z" })], "2026-09-28", 2);
    expect(w[0]).toMatchObject({ planned: 2, done: 1, rate: 0.5 });
  });

  it("today's pending tasks don't count against the rate yet", () => {
    const w = weeklyCompletion([st({ original_date: "2026-09-28" })], "2026-09-28", 1);
    expect(w[0].planned).toBe(0);
  });

  it("heatmap buckets counts into levels", () => {
    const tasks = Array.from({ length: 4 }, () => st({ status: "done", completed_at: "2026-09-28T06:00:00Z" }));
    const h = heatmap(tasks, "Asia/Kolkata", "2026-09-27", "2026-09-28");
    expect(h).toHaveLength(2);
    expect(h[0].level).toBe(0);
    expect(h[1]).toMatchObject({ count: 4, level: 3, minutes: 120 });
  });

  it("planned vs actual uses logged minutes when present", () => {
    const tasks = [st({ status: "done", actual_minutes: 50, completed_at: "2026-09-28T06:00:00Z" }), st({})];
    const p = plannedVsActual(tasks, "Asia/Kolkata", "2026-09-28", "2026-09-28");
    expect(p[0]).toEqual({ date: "2026-09-28", planned: 60, actual: 50 });
  });

  it("finds the strongest weekday with enough samples", () => {
    const mon = "2026-09-21";
    const tasks = [0, 7, 14].flatMap((off) => [
      st({ original_date: addDays(mon, -off), status: "done", completed_at: `${addDays(mon, -off)}T06:00:00Z` }),
      st({ original_date: addDays(mon, 1 - off), status: "pending" }),
    ]);
    expect(bestWeekday(tasks, "2026-09-28")).toEqual({ day: "Mon", rate: 1 });
  });
});

describe("dates", () => {
  it("startOfWeek is Monday", () => {
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21"); // Sunday → previous Monday
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
    expect(localDate("2026-09-28T19:00:00Z", "Asia/Kolkata")).toBe("2026-09-29");
  });
});

describe("schedule", () => {
  it("lays phases end-to-end and spreads milestones", () => {
    const r = phaseDates([{ duration_weeks: 2, milestones: [1, 2] }, { duration_weeks: 1, milestones: [1] }], "2026-09-28");
    expect(r[0]).toMatchObject({ start_date: "2026-09-28", end_date: "2026-10-11", milestoneDates: ["2026-10-04", "2026-10-11"] });
    expect(r[1]).toMatchObject({ start_date: "2026-10-12", end_date: "2026-10-18" });
  });

  it("fitToCapacity rolls surplus tasks forward in order", () => {
    const out = fitToCapacity(
      [
        { day: 1, estimated_minutes: 40 },
        { day: 1, estimated_minutes: 40 },
        { day: 2, estimated_minutes: 30 },
      ],
      60,
    );
    expect(out.map((t) => t.day)).toEqual([1, 2, 3]) // 40 + 30 > 60, so the day-2 task also rolls;
  });
});

describe("nudges", () => {
  const base = {
    streak: { current: 0, longest: 0, todayDone: false },
    overdueCount: 0,
    todayPending: 2,
    todayMinutes: 60,
    recentEnergy: [],
    bestWeekday: null,
    todayWeekday: "Mon",
    lastWeekRate: null,
    prevWeekRate: null,
    topGoal: null,
    daysSinceActive: null,
  };
  it("celebrates a record streak", () => {
    const n = computeNudges({ ...base, streak: { current: 5, longest: 5, todayDone: true } });
    expect(n[0].id).toBe("record");
  });
  it("warns about low energy with real numbers", () => {
    const n = computeNudges({ ...base, recentEnergy: [2, 2, 1] });
    expect(n[0].id).toBe("energy");
    expect(n[0].text).toContain("1.7");
  });
  it("falls back to a concrete today message", () => {
    expect(computeNudges(base)[0].id).toBe("today");
  });
});
