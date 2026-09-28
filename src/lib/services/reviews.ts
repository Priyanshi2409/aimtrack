import "server-only";
import { writeReview } from "@/lib/ai/agents";
import { addDays, localDate, startOfMonth, startOfWeek, todayIn, WEEKDAYS, weekdayIndex, type ISODate } from "@/lib/core/dates";
import { activeDays, computeStreak } from "@/lib/core/streak";
import { completionRate, minutesOf } from "@/lib/core/stats";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import type { ReviewStats } from "@/lib/types";

/** Deterministic stats for a period; the AI only writes the prose around them. */
async function gather(userId: string, goalId: string | null, from: ISODate, to: ISODate) {
  return withUser(userId, async (tx) => {
    const profile = await repo.getProfile(tx, userId);
    const goal = goalId ? await repo.getGoal(tx, goalId) : null;
    const all = await repo.allTasks(tx, { since: addDays(from, -60) });
    const tasks = goalId ? all.filter((t) => t.goal_id === goalId) : all;
    const tz = profile.timezone;
    const inPeriod = tasks.filter((t) => t.original_date >= from && t.original_date <= to);
    const rate = completionRate(tasks, from, to, addDays(to, 1));
    const doneInPeriod = tasks.filter((t) => t.status === "done" && t.completed_at && localDate(t.completed_at, tz) >= from && localDate(t.completed_at, tz) <= to);
    const byDay = new Map<number, number>();
    for (const t of doneInPeriod) byDay.set(weekdayIndex(localDate(t.completed_at!, tz)), (byDay.get(weekdayIndex(localDate(t.completed_at!, tz))) ?? 0) + 1);
    const bestIdx = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const checkins = await repo.checkinsBetween(tx, from, to);
    const replans = (await repo.replanEvents(tx, { goalId: goalId ?? undefined, limit: 10 })).filter((e) => new Date(e.created_at).toISOString().slice(0, 10) >= from);
    const stats: ReviewStats = {
      planned: rate.planned,
      done: rate.done,
      completion_rate: Number(rate.rate.toFixed(3)),
      minutes: doneInPeriod.reduce((s, t) => s + minutesOf(t), 0),
      streak: computeStreak(activeDays(all, tz), to).current,
      best_day: bestIdx !== undefined ? WEEKDAYS[bestIdx] : null,
      avg_energy: checkins.length ? Number((checkins.reduce((s, c) => s + c.energy, 0) / checkins.length).toFixed(1)) : null,
    };
    return {
      goal,
      stats,
      doneTitles: doneInPeriod.map((t) => t.title),
      missedTitles: inPeriod.filter((t) => t.status !== "done").map((t) => t.title),
      blockers: checkins.map((c) => c.blocker).filter((b): b is string => Boolean(b)),
      replans: replans.map((r) => r.summary),
      today: todayIn(tz),
    };
  });
}

export async function generateReview(userId: string, opts: { goalId: string | null; kind: "weekly" | "monthly"; periodStart?: ISODate }) {
  const today = await withUser(userId, async (tx) => todayIn((await repo.getProfile(tx, userId)).timezone));
  let from: ISODate;
  let to: ISODate;
  if (opts.kind === "weekly") {
    from = opts.periodStart ?? addDays(startOfWeek(today), -7); // default: last full week
    to = addDays(from, 6);
  } else {
    from = opts.periodStart ?? startOfMonth(addDays(startOfMonth(today), -1));
    const nextMonth = startOfMonth(addDays(from, 32));
    to = addDays(nextMonth, -1);
  }
  if (to > today) to = today; // partial period ("so far")
  const g = await gather(userId, opts.goalId, from, to);
  const res = await writeReview({ kind: opts.kind, goalTitle: g.goal?.title ?? null, stats: g.stats, doneTitles: g.doneTitles, missedTitles: g.missedTitles, blockers: g.blockers, replans: g.replans });
  await withUser(userId, async (tx) => {
    await repo.upsertReview(tx, userId, {
      goal_id: opts.goalId,
      kind: opts.kind,
      period_start: from,
      period_end: to,
      stats: g.stats,
      content: res.data,
      ai_generated: res.live,
    });
    await repo.logAiCall(tx, userId, "review");
  });
  return { from, to, stats: g.stats, content: res.data, live: res.live };
}

/** Called by the daily cron: last week's review per active goal (Mondays) + monthly report (1st). */
export async function scheduledReviews(userId: string) {
  const { today, goals } = await withUser(userId, async (tx) => ({
    today: todayIn((await repo.getProfile(tx, userId)).timezone),
    goals: (await repo.listGoals(tx)).filter((g) => g.status === "active"),
  }));
  const lastWeek = addDays(startOfWeek(today), -7);
  let made = 0;
  for (const g of goals) {
    if (g.start_date && g.start_date > addDays(lastWeek, 6)) continue;
    const exists = await withUser(userId, (tx) => repo.hasReview(tx, g.id, "weekly", lastWeek));
    if (!exists) {
      await generateReview(userId, { goalId: g.id, kind: "weekly", periodStart: lastWeek });
      made++;
    }
  }
  const lastMonth = startOfMonth(addDays(startOfMonth(today), -1));
  const monthEnd = addDays(startOfMonth(today), -1);
  if (goals.some((g) => g.start_date && g.start_date <= monthEnd) && !(await withUser(userId, (tx) => repo.hasReview(tx, null, "monthly", lastMonth)))) {
    await generateReview(userId, { goalId: null, kind: "monthly", periodStart: lastMonth });
    made++;
  }
  return made;
}
