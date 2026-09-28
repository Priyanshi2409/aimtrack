import { addDays, localDate, type ISODate } from "./dates";

export interface StreakInfo {
  current: number;
  longest: number;
  /** true when today already counts toward the streak */
  todayDone: boolean;
}

/** Days on which the user completed at least one task (in their timezone). */
export function activeDays(
  tasks: { status: string; completed_at: string | null }[],
  timeZone: string,
): Set<ISODate> {
  const days = new Set<ISODate>();
  for (const t of tasks) {
    if (t.status === "done" && t.completed_at) days.add(localDate(t.completed_at, timeZone));
  }
  return days;
}

/**
 * Current streak = consecutive active days ending today. If today has no activity
 * yet, the streak is still "alive" and counts back from yesterday — it only breaks
 * once a full day passes with nothing done.
 */
export function computeStreak(active: Set<ISODate>, today: ISODate): StreakInfo {
  const todayDone = active.has(today);
  let current = 0;
  let cursor = todayDone ? today : addDays(today, -1);
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  const sorted = [...active].filter((d) => d <= today).sort();
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current), todayDone };
}
