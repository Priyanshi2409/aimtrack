import { addDays, localDate, rangeDays, startOfWeek, weekdayIndex, WEEKDAYS, type ISODate } from "./dates";

export interface StatTask {
  goal_id: string;
  phase_id?: string | null;
  status: "pending" | "done" | "skipped";
  scheduled_date: ISODate;
  original_date: ISODate;
  estimated_minutes: number;
  actual_minutes: number | null;
  completed_at: string | null;
}

export const minutesOf = (t: StatTask) => t.actual_minutes ?? t.estimated_minutes;

/** Tasks that count as "planned" for a past period: originally due in it, and not pending today. */
function isDueBy(t: StatTask, today: ISODate) {
  return t.original_date < today || (t.original_date === today && t.status !== "pending");
}

export interface HeatCell {
  date: ISODate;
  count: number;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
}

/** GitHub-style consistency grid: completed tasks per day, bucketed into 5 levels. */
export function heatmap(tasks: StatTask[], timeZone: string, from: ISODate, to: ISODate): HeatCell[] {
  const counts = new Map<ISODate, { count: number; minutes: number }>();
  for (const t of tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    const d = localDate(t.completed_at, timeZone);
    const c = counts.get(d) ?? { count: 0, minutes: 0 };
    c.count++;
    c.minutes += minutesOf(t);
    counts.set(d, c);
  }
  return rangeDays(from, to).map((date) => {
    const c = counts.get(date) ?? { count: 0, minutes: 0 };
    const level = (c.count === 0 ? 0 : c.count === 1 ? 1 : c.count <= 3 ? 2 : c.count <= 5 ? 3 : 4) as HeatCell["level"];
    return { date, ...c, level };
  });
}

export interface WeekRate {
  week_start: ISODate;
  planned: number;
  done: number;
  rate: number;
}

/** Completion rate per week, based on what was originally planned for that week.
 * Skipped tasks count as not done: skipping is allowed, but the metric stays honest. */
export function weeklyCompletion(tasks: StatTask[], today: ISODate, weeks: number): WeekRate[] {
  const current = startOfWeek(today);
  const out: WeekRate[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(current, -7 * i);
    const we = addDays(ws, 6);
    const due = tasks.filter((t) => t.original_date >= ws && t.original_date <= we && isDueBy(t, today));
    const done = due.filter((t) => t.status === "done").length;
    out.push({ week_start: ws, planned: due.length, done, rate: due.length ? done / due.length : 0 });
  }
  return out;
}

export function completionRate(tasks: StatTask[], from: ISODate, to: ISODate, today: ISODate) {
  const due = tasks.filter((t) => t.original_date >= from && t.original_date <= to && isDueBy(t, today));
  const done = due.filter((t) => t.status === "done").length;
  return { planned: due.length, done, rate: due.length ? done / due.length : 0 };
}

export interface DayPva {
  date: ISODate;
  planned: number;
  actual: number;
}

/** Planned minutes (by original plan) vs minutes actually logged, per day. */
export function plannedVsActual(tasks: StatTask[], timeZone: string, from: ISODate, to: ISODate): DayPva[] {
  const planned = new Map<ISODate, number>();
  const actual = new Map<ISODate, number>();
  for (const t of tasks) {
    if (t.status !== "skipped") planned.set(t.original_date, (planned.get(t.original_date) ?? 0) + t.estimated_minutes);
    if (t.status === "done" && t.completed_at) {
      const d = localDate(t.completed_at, timeZone);
      actual.set(d, (actual.get(d) ?? 0) + minutesOf(t));
    }
  }
  return rangeDays(from, to).map((date) => ({ date, planned: planned.get(date) ?? 0, actual: actual.get(date) ?? 0 }));
}

export function minutesByGoal(tasks: StatTask[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) if (t.status === "done") m.set(t.goal_id, (m.get(t.goal_id) ?? 0) + minutesOf(t));
  return m;
}

/** Which weekday the user completes the highest share of planned work on (needs ≥3 samples). */
export function bestWeekday(tasks: StatTask[], today: ISODate, lookbackDays = 42): { day: string; rate: number } | null {
  const from = addDays(today, -lookbackDays);
  const agg = Array.from({ length: 7 }, () => ({ planned: 0, done: 0 }));
  for (const t of tasks) {
    if (t.original_date < from || !isDueBy(t, today)) continue;
    const w = weekdayIndex(t.original_date);
    agg[w].planned++;
    if (t.status === "done") agg[w].done++;
  }
  let best: { day: string; rate: number } | null = null;
  agg.forEach((a, i) => {
    if (a.planned < 3) return;
    const rate = a.done / a.planned;
    if (!best || rate > best.rate) best = { day: WEEKDAYS[i], rate };
  });
  return best;
}

export function progressOf(tasks: { status: string }[]) {
  const total = tasks.filter((t) => t.status !== "skipped").length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
