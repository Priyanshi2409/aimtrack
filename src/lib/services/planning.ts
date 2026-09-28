import "server-only";
import { generateNextWeek } from "@/lib/ai/agents";
import type { GoalContext } from "@/lib/ai/prompts";
import type { Plan } from "@/lib/ai/schemas";
import { addDays, todayIn, type ISODate } from "@/lib/core/dates";
import { dateForDay, phaseDates, phaseIndexForDate } from "@/lib/core/schedule";
import { completionRate } from "@/lib/core/stats";
import { withUser, type Tx } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import type { Goal } from "@/lib/types";

export function goalContext(goal: Goal, today: ISODate, startOverride?: ISODate): GoalContext {
  return {
    title: goal.title,
    raw_input: goal.raw_input,
    category: goal.category,
    answers: goal.context?.answers ?? [],
    start_date: startOverride ?? goal.start_date ?? today,
    deadline: goal.deadline,
    minutes_per_day: goal.minutes_per_day,
    today,
  };
}

/** Writes a validated plan to the database as phases → milestones → dated tasks. */
export async function materializePlan(tx: Tx, userId: string, goal: Goal, plan: Plan, start: ISODate) {
  await repo.clearPlan(tx, goal.id);
  const ranges = phaseDates(plan.phases, start);
  const phaseIds: string[] = [];
  const milestoneIds: string[][] = [];
  for (let i = 0; i < plan.phases.length; i++) {
    const p = plan.phases[i];
    const id = await repo.insertPhase(tx, userId, goal.id, {
      idx: i,
      title: p.title,
      description: p.description ?? null,
      duration_weeks: p.duration_weeks,
      start_date: ranges[i].start_date,
      end_date: ranges[i].end_date,
      weekly_targets: p.weekly_targets,
    });
    phaseIds.push(id);
    const ms: string[] = [];
    for (let j = 0; j < p.milestones.length; j++) {
      ms.push(
        await repo.insertMilestone(tx, userId, goal.id, id, {
          idx: j,
          title: p.milestones[j].title,
          success_criteria: p.milestones[j].success_criteria,
          target_date: ranges[i].milestoneDates[j],
        }),
      );
    }
    milestoneIds.push(ms);
  }
  await repo.insertTasks(
    tx,
    userId,
    plan.daily_tasks.map((t, i) => ({
      goal_id: goal.id,
      phase_id: phaseIds[t.phase_index] ?? phaseIds[0],
      milestone_id: t.milestone_index == null ? null : (milestoneIds[t.phase_index]?.[t.milestone_index] ?? null),
      title: t.title,
      description: t.description || null,
      why: t.why,
      estimated_minutes: t.estimated_minutes,
      difficulty: t.difficulty,
      resource_url: t.resource_url ?? null,
      resource_query: t.resource_query ?? null,
      scheduled_date: dateForDay(start, t.day),
      sort_order: i,
    })),
  );
  const lastPhaseEnd = ranges[ranges.length - 1].end_date;
  await repo.updateGoal(tx, goal.id, {
    status: "active",
    start_date: start,
    feasibility: plan.feasibility,
    real_world_examples: plan.real_world_examples,
    deadline: goal.deadline ?? lastPhaseEnd,
    last_replanned_on: start,
  });
}

/** Does this goal need another week of tasks generated? */
export function needsExtension(goal: Goal, tasks: { scheduled_date: ISODate }[], today: ISODate): ISODate | null {
  if (goal.status !== "active") return null;
  const last = tasks.reduce<ISODate | null>((m, t) => (!m || t.scheduled_date > m ? t.scheduled_date : m), null);
  if (goal.deadline && goal.deadline <= today) return null;
  if (last && last >= addDays(today, 4)) return null;
  const from = last && last >= today ? addDays(last, 1) : today;
  if (goal.deadline && from > goal.deadline) return null;
  return from;
}

/** Generates the next 7 days of tasks (rolling horizon). Safe to call repeatedly. */
export async function extendHorizon(userId: string, goalId: string): Promise<{ added: number; live: boolean } | null> {
  const snapshot = await withUser(userId, async (tx) => {
    const goal = await repo.getGoal(tx, goalId);
    if (!goal) return null;
    const profile = await repo.getProfile(tx, userId);
    const today = todayIn(profile.timezone);
    const tasks = await repo.tasksForGoal(tx, goalId);
    const from = needsExtension(goal, tasks, today);
    if (!from) return null;
    const { phases, milestones } = await repo.getRoadmap(tx, goalId);
    if (!phases.length) return null;
    const { findings } = await repo.getResearch(tx, goalId);
    return { goal, today, tasks, from, phases, milestones, findings };
  });
  if (!snapshot) return null;
  const { goal, today, tasks, from, phases, milestones, findings } = snapshot;
  const pIdx = phaseIndexForDate(phases, from);
  const phase = phases[pIdx];
  const rate = completionRate(tasks, addDays(today, -14), today, today).rate;

  const res = await generateNextWeek(goalContext(goal, today, from), {
    phaseIndex: pIdx,
    phaseTitle: phase.title,
    weeklyTargets: phase.weekly_targets,
    milestones: milestones.filter((m) => m.phase_id === phase.id).map((m) => m.title),
    recentDone: tasks.filter((t) => t.status === "done").slice(-15).map((t) => t.title),
    completionRate: rate,
    findings,
  });

  await withUser(userId, async (tx) => {
    // Re-check inside the write transaction to avoid double-extension from concurrent calls.
    const fresh = await repo.tasksForGoal(tx, goalId);
    if (!needsExtension(goal, fresh, today)) return;
    const maxOrder = fresh.reduce((m, t) => Math.max(m, t.sort_order), 0);
    const phaseMs = milestones.filter((m) => m.phase_id === phase.id);
    await repo.insertTasks(
      tx,
      userId,
      res.data.daily_tasks
        .map((t, i) => ({
          goal_id: goalId,
          phase_id: phase.id,
          milestone_id: t.milestone_index == null ? null : (phaseMs[t.milestone_index]?.id ?? null),
          title: t.title,
          description: t.description || null,
          why: t.why,
          estimated_minutes: t.estimated_minutes,
          difficulty: t.difficulty,
          resource_url: t.resource_url ?? null,
          resource_query: t.resource_query ?? null,
          scheduled_date: addDays(from, t.day - 1),
          sort_order: maxOrder + 1 + i,
        }))
        .filter((t) => !goal.deadline || t.scheduled_date <= goal.deadline),
    );
    await repo.logAiCall(tx, userId, "extend");
  });
  return { added: res.data.daily_tasks.length, live: res.live };
}
