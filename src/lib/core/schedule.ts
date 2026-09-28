import { addDays, type ISODate } from "./dates";

/** Turns relative plan structure (weeks, day offsets) into concrete calendar dates. */

export interface PhaseLike {
  duration_weeks: number;
  milestones: unknown[];
}

export function phaseDates(phases: PhaseLike[], start: ISODate) {
  let cursor = start;
  return phases.map((p) => {
    const start_date = cursor;
    const end_date = addDays(cursor, p.duration_weeks * 7 - 1);
    cursor = addDays(end_date, 1);
    const days = p.duration_weeks * 7;
    const n = Math.max(1, p.milestones.length);
    const milestoneDates = p.milestones.map((_, i) => addDays(start_date, Math.max(0, Math.round(((i + 1) / n) * days) - 1)));
    return { start_date, end_date, milestoneDates };
  });
}

export function dateForDay(start: ISODate, day: number): ISODate {
  return addDays(start, Math.max(1, day) - 1);
}

/** Phase index that contains a given date (clamped to the last phase). */
export function phaseIndexForDate(ranges: { start_date: ISODate; end_date: ISODate }[], d: ISODate): number {
  const i = ranges.findIndex((r) => d >= r.start_date && d <= r.end_date);
  return i === -1 ? Math.max(0, ranges.length - 1) : i;
}

/**
 * Keeps each generated day within the user's daily capacity: if the model packed a day
 * too full, surplus tasks roll to the next day (order preserved).
 */
export function fitToCapacity<T extends { day: number; estimated_minutes: number }>(tasks: T[], capacity: number): T[] {
  const sorted = [...tasks].sort((a, b) => a.day - b.day);
  const out: T[] = [];
  let day = 0;
  let load = 0;
  for (const t of sorted) {
    if (t.day > day) {
      day = t.day;
      load = 0;
    }
    if (load > 0 && load + t.estimated_minutes > capacity) {
      day++;
      load = 0;
    }
    out.push({ ...t, day });
    load += t.estimated_minutes;
  }
  return out;
}
