import "server-only";
import { todayIn } from "@/lib/core/dates";
import { energyFactorFrom, lightenDay, pullAhead, replanBehind, type ReplanResult } from "@/lib/core/replan";
import type { Tx } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import type { Goal, Task } from "@/lib/types";

async function persist(tx: Tx, userId: string, goal: Goal, r: ReplanResult) {
  if (!r.moves.length || r.kind === "none") return;
  await repo.applyMoves(tx, r.moves);
  await repo.insertReplanEvent(tx, userId, goal.id, { kind: r.kind, summary: r.summary, changes: r.moves });
}

/**
 * Daily maintenance, idempotent per day: for every active goal that hasn't been
 * checked today, rebalance missed tasks into upcoming days. Runs on page load and in cron.
 */
export async function autoReplanAll(tx: Tx, userId: string): Promise<number> {
  const profile = await repo.getProfile(tx, userId);
  const today = todayIn(profile.timezone);
  const goals = (await repo.listGoals(tx)).filter((g) => g.status === "active" && (g.last_replanned_on ?? "") < today);
  if (!goals.length) return 0;
  const energies = (await repo.recentCheckins(tx, 3)).map((c) => c.energy);
  const energyFactor = energyFactorFrom(energies);
  let events = 0;
  for (const goal of goals) {
    // Atomically claim today's run for this goal: concurrent requests block on the row lock
    // and then skip, so the same slip is never rebalanced (or reported) twice.
    const claimed = await tx`
      update goals set last_replanned_on = ${today}
      where id = ${goal.id} and (last_replanned_on is null or last_replanned_on < ${today}) returning id`;
    if (!claimed.length) continue;
    const tasks = await repo.tasksForGoal(tx, goal.id);
    const r = replanBehind(tasks, { today, capacityMinutes: goal.minutes_per_day, energyFactor });
    if (r.kind !== "none") {
      await persist(tx, userId, goal, r);
      events++;
    }
  }
  return events;
}

/** Manual "Replan now" for one goal. */
export async function replanGoal(tx: Tx, userId: string, goal: Goal, today: string): Promise<ReplanResult> {
  const tasks = await repo.tasksForGoal(tx, goal.id);
  const energies = (await repo.recentCheckins(tx, 3)).map((c) => c.energy);
  const r = replanBehind(tasks, { today, capacityMinutes: goal.minutes_per_day, energyFactor: energyFactorFrom(energies) });
  await persist(tx, userId, goal, r);
  await repo.updateGoal(tx, goal.id, { last_replanned_on: today });
  return r;
}

/**
 * "I only have N minutes today": caps today across ALL active goals. The budget is
 * split in proportion to each goal's own daily minutes.
 */
export async function lightenToday(tx: Tx, userId: string, minutes: number, today: string): Promise<ReplanResult[]> {
  const goals = (await repo.listGoals(tx)).filter((g) => g.status === "active");
  const total = goals.reduce((s, g) => s + g.minutes_per_day, 0) || 1;
  const out: ReplanResult[] = [];
  for (const goal of goals) {
    const share = Math.max(10, Math.round((minutes * goal.minutes_per_day) / total));
    const tasks = await repo.tasksForGoal(tx, goal.id);
    const r = lightenDay(tasks, { today, capacityMinutes: goal.minutes_per_day, minutes: share });
    if (r.moves.length) {
      r.summary = `${goal.title}: ${r.summary}`;
      await persist(tx, userId, goal, r);
    }
    out.push(r);
  }
  return out;
}

/** Offer to pull upcoming work forward when today's list is done. */
export function aheadSuggestion(goal: Goal, tasks: Task[], today: string): ReplanResult {
  return pullAhead(tasks, { today, capacityMinutes: goal.minutes_per_day });
}

export async function applyAhead(tx: Tx, userId: string, goal: Goal, today: string): Promise<ReplanResult> {
  const tasks = await repo.tasksForGoal(tx, goal.id);
  const r = pullAhead(tasks, { today, capacityMinutes: goal.minutes_per_day });
  await persist(tx, userId, goal, r);
  return r;
}
