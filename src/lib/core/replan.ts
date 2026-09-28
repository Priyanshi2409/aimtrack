import { addDays, diffDays, formatDate, formatMinutes, type ISODate } from "./dates";

/**
 * Deterministic replanning engine.
 *
 * Design principles
 *  - Order is preserved: missed work goes *before* later work, because plans are
 *    usually sequential (you learn A before B).
 *  - No day is ever loaded beyond the daily capacity (except a single task that is
 *    on its own larger than capacity — it gets a day to itself).
 *  - Slack is used first: days that are under capacity absorb missed work, so the
 *    end date only moves when it has to.
 *  - Everything is explainable: the result lists each move plus a human summary.
 */

export interface PlanTask {
  id: string;
  title: string;
  scheduled_date: ISODate;
  estimated_minutes: number;
  status: "pending" | "done" | "skipped";
  sort_order: number;
  moved_count: number;
}

export interface Move {
  taskId: string;
  title: string;
  from: ISODate;
  to: ISODate;
}

export interface ReplanOptions {
  today: ISODate;
  capacityMinutes: number;
  /** 0.5–1 multiplier applied to today's capacity (e.g. after low-energy check-ins) */
  energyFactor?: number;
  /** explicit per-day capacity overrides, e.g. "I only have 60 minutes today" */
  capacityOverrides?: Record<ISODate, number>;
  /** safety bound on how far forward we will look */
  maxDays?: number;
}

export interface ReplanResult {
  kind: "behind" | "ahead" | "manual" | "none";
  moves: Move[];
  summary: string;
  overdueCount: number;
  overdueMinutes: number;
  endShiftDays: number;
  atRisk: string[];
}

const byOrder = (a: PlanTask, b: PlanTask) =>
  a.scheduled_date.localeCompare(b.scheduled_date) || a.sort_order - b.sort_order;

function capacityFor(day: ISODate, o: ReplanOptions): number {
  if (o.capacityOverrides && day in o.capacityOverrides) return o.capacityOverrides[day];
  const factor = day === o.today ? Math.min(1, Math.max(0.5, o.energyFactor ?? 1)) : 1;
  return Math.round(o.capacityMinutes * factor);
}

/** Core packing routine shared by every replan mode. */
function repack(tasks: PlanTask[], o: ReplanOptions, initialCarry: PlanTask[]) {
  const maxDays = o.maxDays ?? 730;
  const pending = tasks.filter((t) => t.status === "pending");
  const carryIds = new Set(initialCarry.map((t) => t.id));
  const byDay = new Map<ISODate, PlanTask[]>();
  for (const t of pending) {
    if (carryIds.has(t.id)) continue;
    const list = byDay.get(t.scheduled_date) ?? [];
    list.push(t);
    byDay.set(t.scheduled_date, list);
  }
  // Minutes already "used" on each day by completed tasks.
  const fixed = new Map<ISODate, number>();
  for (const t of tasks) {
    if (t.status === "done") fixed.set(t.scheduled_date, (fixed.get(t.scheduled_date) ?? 0) + t.estimated_minutes);
  }

  const newDate = new Map<string, ISODate>();
  let carry = [...initialCarry].sort(byOrder);
  let day = o.today;
  let guard = 0;
  do {
    const own = (byDay.get(day) ?? []).sort(byOrder);
    const queue = [...carry, ...own];
    const cap = capacityFor(day, o);
    // A task bigger than the daily limit still gets a day to itself (otherwise it could never be
    // scheduled) — except on days with an explicit user cap, which is always respected.
    const allowOversize = !(o.capacityOverrides && day in o.capacityOverrides);
    let load = fixed.get(day) ?? 0;
    let placedAny = load > 0;
    const next: PlanTask[] = [];
    let blocked = false;
    for (const t of queue) {
      const fits = load + t.estimated_minutes <= cap || (allowOversize && !placedAny && cap > 0);
      if (!blocked && fits) {
        newDate.set(t.id, day);
        load += t.estimated_minutes;
        placedAny = true;
      } else {
        blocked = true; // keep strict order: once one task spills, everything after it spills
        next.push(t);
      }
    }
    carry = next;
    day = addDays(day, 1);
    guard++;
  } while (carry.length > 0 && guard < maxDays);

  const moves: Move[] = [];
  for (const t of pending) {
    const to = newDate.get(t.id);
    if (to && to !== t.scheduled_date) moves.push({ taskId: t.id, title: t.title, from: t.scheduled_date, to });
  }
  moves.sort((a, b) => a.to.localeCompare(b.to));
  const lastBefore = pending.reduce<ISODate | null>((m, t) => (!m || t.scheduled_date > m ? t.scheduled_date : m), null);
  const lastAfter = pending.reduce<ISODate | null>((m, t) => {
    const d = newDate.get(t.id) ?? t.scheduled_date;
    return !m || d > m ? d : m;
  }, null);
  const endShiftDays = lastBefore && lastAfter ? Math.max(0, diffDays(lastAfter, lastBefore)) : 0;
  return { moves, endShiftDays };
}

/** Rebalance after missed tasks. Returns kind "none" when nothing is overdue. */
export function replanBehind(tasks: PlanTask[], o: ReplanOptions): ReplanResult {
  const overdue = tasks.filter((t) => t.status === "pending" && t.scheduled_date < o.today).sort(byOrder);
  if (overdue.length === 0) {
    return { kind: "none", moves: [], summary: "You're on track — nothing to rebalance.", overdueCount: 0, overdueMinutes: 0, endShiftDays: 0, atRisk: [] };
  }
  const { moves, endShiftDays } = repack(tasks, o, overdue);
  const overdueMinutes = overdue.reduce((s, t) => s + t.estimated_minutes, 0);
  const atRisk = overdue.filter((t) => t.moved_count + 1 >= 3).map((t) => t.title);

  const lastTarget = moves.reduce<ISODate>((m, mv) => (mv.to > m ? mv.to : m), o.today);
  const span = diffDays(lastTarget, o.today) + 1;
  const parts: string[] = [];
  parts.push(
    `${overdue.length} task${overdue.length > 1 ? "s" : ""} (${formatMinutes(overdueMinutes)}) slipped, so I spread ${
      overdue.length > 1 ? "them" : "it"
    } over the next ${span} day${span > 1 ? "s" : ""} in the original order.`,
  );
  const shifted = moves.filter((m) => !overdue.some((t) => t.id === m.taskId)).length;
  if (shifted > 0) parts.push(`${shifted} later task${shifted > 1 ? "s" : ""} moved back to make room.`);
  parts.push(`No day goes over your ${formatMinutes(o.capacityMinutes)} daily limit.`);
  if (o.energyFactor !== undefined && o.energyFactor < 1) {
    parts.push(`Today is trimmed to ${formatMinutes(capacityFor(o.today, o))} because your recent energy check-ins were low.`);
  }
  parts.push(
    endShiftDays > 0
      ? `This pushes your current plan's end by ${endShiftDays} day${endShiftDays > 1 ? "s" : ""}.`
      : "Your end date didn't move: there was enough slack to absorb it.",
  );
  if (atRisk.length) {
    parts.push(`"${atRisk[0]}"${atRisk.length > 1 ? ` and ${atRisk.length - 1} more` : ""} keeps slipping. Consider shrinking or dropping it.`);
  }
  return { kind: "behind", moves, summary: parts.join(" "), overdueCount: overdue.length, overdueMinutes, endShiftDays, atRisk };
}

/** "I only have N minutes today": push today's excess work forward, cascading as needed. */
export function lightenDay(tasks: PlanTask[], o: ReplanOptions & { minutes: number }): ReplanResult {
  const overdue = tasks.filter((t) => t.status === "pending" && t.scheduled_date < o.today);
  const { moves, endShiftDays } = repack(tasks, { ...o, capacityOverrides: { ...o.capacityOverrides, [o.today]: o.minutes } }, overdue);
  const pushed = moves.filter((m) => m.from === o.today).length;
  const summary = moves.length
    ? `Today is capped at ${formatMinutes(o.minutes)}. I moved ${pushed || moves.length} task${
        (pushed || moves.length) > 1 ? "s" : ""
      } to later days${endShiftDays ? `, shifting the plan end by ${endShiftDays} day${endShiftDays > 1 ? "s" : ""}` : " without moving your end date"}.`
    : `Today's plan already fits in ${formatMinutes(o.minutes)}. Nothing to change.`;
  return { kind: "manual", moves, summary, overdueCount: overdue.length, overdueMinutes: 0, endShiftDays, atRisk: [] };
}

/**
 * Ahead of plan: pull the earliest upcoming tasks into today's remaining capacity.
 * Only applies when nothing is overdue and everything scheduled today is done.
 */
export function pullAhead(tasks: PlanTask[], o: ReplanOptions & { maxTasks?: number }): ReplanResult {
  const none: ReplanResult = { kind: "none", moves: [], summary: "", overdueCount: 0, overdueMinutes: 0, endShiftDays: 0, atRisk: [] };
  const pending = tasks.filter((t) => t.status === "pending");
  if (pending.some((t) => t.scheduled_date <= o.today)) return none;
  const doneToday = tasks
    .filter((t) => t.status === "done" && t.scheduled_date === o.today)
    .reduce((s, t) => s + t.estimated_minutes, 0);
  let room = capacityFor(o.today, o) - doneToday;
  const upcoming = pending.filter((t) => t.scheduled_date > o.today).sort(byOrder);
  const moves: Move[] = [];
  for (const t of upcoming) {
    if (moves.length >= (o.maxTasks ?? 3) || t.estimated_minutes > room) break; // stay in order
    moves.push({ taskId: t.id, title: t.title, from: t.scheduled_date, to: o.today });
    room -= t.estimated_minutes;
  }
  if (!moves.length) return none;
  const mins = upcoming.slice(0, moves.length).reduce((s, t) => s + t.estimated_minutes, 0);
  return {
    kind: "ahead",
    moves,
    summary: `You're ahead of plan! I pulled ${moves.length} task${moves.length > 1 ? "s" : ""} (${formatMinutes(mins)}) forward from ${formatDate(
      moves[0].from,
      { weekday: "long" },
    )}, still within today's ${formatMinutes(o.capacityMinutes)} limit.`,
    overdueCount: 0,
    overdueMinutes: 0,
    endShiftDays: 0,
    atRisk: [],
  };
}

/** Energy factor from the last few check-ins (1–5 scale). */
export function energyFactorFrom(energies: number[]): number {
  if (energies.length < 2) return 1;
  const recent = energies.slice(-3);
  const avg = recent.reduce((s, e) => s + e, 0) / recent.length;
  if (avg <= 1.75) return 0.6;
  if (avg <= 2.5) return 0.8;
  return 1;
}
