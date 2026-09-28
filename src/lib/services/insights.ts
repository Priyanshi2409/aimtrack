import "server-only";
import { addDays, diffDays, localDate, startOfWeek, todayIn, WEEKDAYS, weekdayIndex, type ISODate } from "@/lib/core/dates";
import { computeNudges } from "@/lib/core/nudges";
import { activeDays, computeStreak } from "@/lib/core/streak";
import { bestWeekday, heatmap, minutesByGoal, plannedVsActual, progressOf, weeklyCompletion } from "@/lib/core/stats";
import type { Tx } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

/** Everything the dashboard / analytics screens need, computed from raw rows in one pass. */
export async function loadInsights(tx: Tx, userId: string) {
  const profile = await repo.getProfile(tx, userId);
  const tz = profile.timezone;
  const today = todayIn(tz);
  const goals = await repo.listGoals(tx);
  const tasks = await repo.allTasks(tx);
  const checkins = await repo.recentCheckins(tx, 30);
  const roadmaps = await Promise.all(goals.map(async (g) => ({ goal: g, ...(await repo.getRoadmap(tx, g.id)) })));

  const active = activeDays(tasks, tz);
  const streak = computeStreak(active, today);
  const weeks = weeklyCompletion(tasks, today, 12);
  const heatFrom = startOfWeek(addDays(today, -7 * 25));
  const heat = heatmap(tasks, tz, heatFrom, today);
  const pva = plannedVsActual(tasks, tz, addDays(today, -13), today);
  const minsByGoal = minutesByGoal(tasks);
  const best = bestWeekday(tasks, today);
  const lastActive = [...active].filter((d) => d <= today).sort().pop() ?? null;

  const todayTasks = tasks.filter((t) => t.scheduled_date === today && goals.find((g) => g.id === t.goal_id)?.status === "active");
  const overdue = tasks.filter((t) => t.status === "pending" && t.scheduled_date < today);
  const topGoalId = [...minsByGoal.entries()].sort((a, b) => b[1] - a[1])[0];
  const topGoal = topGoalId ? { title: goals.find((g) => g.id === topGoalId[0])?.title ?? "", minutes: topGoalId[1] } : null;

  const nudges = computeNudges({
    streak,
    overdueCount: overdue.length,
    todayPending: todayTasks.filter((t) => t.status === "pending").length,
    todayMinutes: todayTasks.filter((t) => t.status === "pending").reduce((s, t) => s + t.estimated_minutes, 0),
    recentEnergy: checkins.map((c) => c.energy),
    bestWeekday: best,
    todayWeekday: WEEKDAYS[weekdayIndex(today)],
    lastWeekRate: weeks.length >= 2 && weeks[weeks.length - 2].planned ? weeks[weeks.length - 2].rate : null,
    prevWeekRate: weeks.length >= 3 && weeks[weeks.length - 3].planned ? weeks[weeks.length - 3].rate : null,
    topGoal,
    daysSinceActive: lastActive ? diffDays(today, lastActive) : null,
  });

  const goalStats = roadmaps.map(({ goal, phases, milestones }) => {
    const gt = tasks.filter((t) => t.goal_id === goal.id);
    const currentPhase = phases.find((p) => today >= p.start_date && today <= p.end_date) ?? phases[phases.length - 1] ?? null;
    const msDone = milestones.filter((m) => m.completed_at).length;
    const elapsed = goal.start_date && goal.deadline ? Math.min(1, Math.max(0, diffDays(today, goal.start_date) / Math.max(1, diffDays(goal.deadline, goal.start_date)))) : 0;
    return {
      goal,
      phases: phases.map((p) => {
        const pt = gt.filter((t) => t.phase_id === p.id);
        const pm = milestones.filter((m) => m.phase_id === p.id);
        return { ...p, progress: progressOf(pt), milestonesDone: pm.filter((m) => m.completed_at).length, milestonesTotal: pm.length };
      }),
      currentPhase,
      milestonesDone: msDone,
      milestonesTotal: milestones.length,
      taskProgress: progressOf(gt.filter((t) => t.scheduled_date <= today)),
      minutes: minsByGoal.get(goal.id) ?? 0,
      timeElapsedPct: Math.round(elapsed * 100),
      weekRate: weeklyCompletion(gt, today, 1)[0],
    };
  });

  return {
    profile,
    today,
    goals,
    tasks,
    todayTasks,
    overdue,
    checkins,
    todayCheckin: checkins.find((c) => c.date === today) ?? null,
    streak,
    weeks,
    heat,
    pva,
    minsByGoal,
    best,
    nudges,
    goalStats,
    totalMinutes: [...minsByGoal.values()].reduce((s, m) => s + m, 0),
    doneToday: tasks.filter((t) => t.status === "done" && t.completed_at && localDate(t.completed_at, tz) === today).length,
  };
}

export type Insights = Awaited<ReturnType<typeof loadInsights>>;

export { type ISODate };
