import { describe, expect, it } from "vitest";
import { energyFactorFrom, lightenDay, pullAhead, replanBehind, type PlanTask } from "@/lib/core/replan";

let n = 0;
const task = (date: string, minutes: number, extra: Partial<PlanTask> = {}): PlanTask => ({
  id: `t${++n}`,
  title: `Task ${n}`,
  scheduled_date: date,
  estimated_minutes: minutes,
  status: "pending",
  sort_order: n,
  moved_count: 0,
  ...extra,
});

const loadByDay = (tasks: PlanTask[], moves: { taskId: string; to: string }[]) => {
  const m = new Map(moves.map((x) => [x.taskId, x.to]));
  const load = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "skipped") continue;
    const d = m.get(t.id) ?? t.scheduled_date;
    load.set(d, (load.get(d) ?? 0) + t.estimated_minutes);
  }
  return load;
};

describe("replanBehind", () => {
  it("does nothing when on track", () => {
    const tasks = [task("2026-09-28", 30), task("2026-09-29", 30)];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    expect(r.kind).toBe("none");
    expect(r.moves).toHaveLength(0);
  });

  it("moves overdue tasks into slack without exceeding capacity", () => {
    const tasks = [
      task("2026-09-26", 30), // overdue
      task("2026-09-27", 30), // overdue
      task("2026-09-28", 30), // today: 30 of 60 used → 30 slack
      task("2026-09-29", 30), // tomorrow: 30 slack
      task("2026-09-30", 60),
    ];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    expect(r.kind).toBe("behind");
    expect(r.overdueCount).toBe(2);
    const load = loadByDay(tasks, r.moves);
    for (const [, mins] of load) expect(mins).toBeLessThanOrEqual(60);
    // No task may remain in the past
    const moved = new Map(r.moves.map((m) => [m.taskId, m.to]));
    for (const t of tasks) expect(moved.get(t.id) ?? t.scheduled_date >= "2026-09-28").toBeTruthy();
    expect(r.summary).toMatch(/slipped/);
  });

  it("preserves the original order of work", () => {
    const tasks = [task("2026-09-25", 40), task("2026-09-26", 40), task("2026-09-28", 40), task("2026-09-29", 40)];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    const moved = new Map(r.moves.map((m) => [m.taskId, m.to]));
    const dates = tasks.map((t) => moved.get(t.id) ?? t.scheduled_date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
    // 40-minute tasks with a 60-minute cap → exactly one per day, 4 consecutive days
    expect(new Set(dates).size).toBe(4);
    expect(r.endShiftDays).toBe(2);
  });

  it("counts done work toward the day's capacity", () => {
    const tasks = [task("2026-09-27", 30), task("2026-09-28", 50, { status: "done" })];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    expect(r.moves[0].to).toBe("2026-09-29");
  });

  it("gives an oversize task its own day instead of looping forever", () => {
    const tasks = [task("2026-09-27", 120), task("2026-09-28", 20)];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    expect(r.moves.find((m) => m.title === tasks[0].title)?.to).toBe("2026-09-28");
    expect(r.moves.find((m) => m.title === tasks[1].title)?.to).toBe("2026-09-29");
  });

  it("trims today when energy is low", () => {
    const tasks = [task("2026-09-27", 30), task("2026-09-28", 30)];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60, energyFactor: 0.6 });
    // today's cap is 36 → only one 30-min task today
    const load = loadByDay(tasks, r.moves);
    expect(load.get("2026-09-28")).toBe(30);
    expect(r.summary).toMatch(/energy/);
  });

  it("flags tasks that keep slipping", () => {
    const tasks = [task("2026-09-27", 30, { moved_count: 2 })];
    const r = replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    expect(r.atRisk).toHaveLength(1);
    expect(r.summary).toMatch(/keeps slipping/);
  });

  it("ignores skipped tasks", () => {
    const tasks = [task("2026-09-27", 30, { status: "skipped" })];
    expect(replanBehind(tasks, { today: "2026-09-28", capacityMinutes: 60 }).kind).toBe("none");
  });
});

describe("lightenDay", () => {
  it("respects an explicit cap even for a large first task", () => {
    const tasks = [task("2026-09-28", 45), task("2026-09-28", 30), task("2026-09-29", 30)];
    const r = lightenDay(tasks, { today: "2026-09-28", capacityMinutes: 90, minutes: 30 });
    const load = loadByDay(tasks, r.moves);
    expect(load.get("2026-09-28") ?? 0).toBeLessThanOrEqual(30);
    for (const [d, mins] of load) if (d !== "2026-09-28") expect(mins).toBeLessThanOrEqual(90);
  });

  it("reports when nothing needs to change", () => {
    const tasks = [task("2026-09-28", 20)];
    const r = lightenDay(tasks, { today: "2026-09-28", capacityMinutes: 60, minutes: 30 });
    expect(r.moves).toHaveLength(0);
    expect(r.summary).toMatch(/already fits/);
  });
});

describe("pullAhead", () => {
  it("pulls upcoming tasks into today's remaining capacity, in order", () => {
    const tasks = [task("2026-09-28", 30, { status: "done" }), task("2026-09-29", 20), task("2026-09-29", 20), task("2026-09-30", 20)];
    const r = pullAhead(tasks, { today: "2026-09-28", capacityMinutes: 60 });
    expect(r.kind).toBe("ahead");
    expect(r.moves).toHaveLength(1); // 30 done + 20 = 50; next 20 would exceed 60
    expect(r.moves[0].to).toBe("2026-09-28");
  });

  it("never pulls forward while today still has pending work", () => {
    const tasks = [task("2026-09-28", 20), task("2026-09-29", 20)];
    expect(pullAhead(tasks, { today: "2026-09-28", capacityMinutes: 60 }).kind).toBe("none");
  });
});

describe("energyFactorFrom", () => {
  it("maps recent energy to a capacity multiplier", () => {
    expect(energyFactorFrom([5])).toBe(1);
    expect(energyFactorFrom([4, 4, 5])).toBe(1);
    expect(energyFactorFrom([2, 2, 3])).toBe(0.8);
    expect(energyFactorFrom([1, 2, 1])).toBe(0.6);
  });
});
