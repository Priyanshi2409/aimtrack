import "server-only";
import { addDays, formatMinutes, todayIn } from "@/lib/core/dates";
import { activeDays, computeStreak } from "@/lib/core/streak";
import { completionRate } from "@/lib/core/stats";
import type { Tx } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

/** Compact, factual context the coach sees: plan, progress, and check-ins. No PII beyond the goal. */
export async function buildCoachContext(tx: Tx, userId: string, goalId: string) {
  const profile = await repo.getProfile(tx, userId);
  const today = todayIn(profile.timezone);
  const goal = await repo.getGoal(tx, goalId);
  if (!goal) return null;
  const { phases, milestones } = await repo.getRoadmap(tx, goalId);
  const tasks = await repo.tasksForGoal(tx, goalId);
  const checkins = await repo.recentCheckins(tx, 7);
  const replans = await repo.replanEvents(tx, { goalId, limit: 3 });
  const phase = phases.find((p) => today >= p.start_date && today <= p.end_date) ?? phases[phases.length - 1];
  const rate = completionRate(tasks, addDays(today, -14), today, today);
  const streak = computeStreak(activeDays(tasks, profile.timezone), today);
  const todays = tasks.filter((t) => t.scheduled_date === today);
  const next = tasks.filter((t) => t.scheduled_date > today && t.scheduled_date <= addDays(today, 7) && t.status === "pending");

  const lines = [
    `TODAY: ${today}`,
    `GOAL: ${goal.title} (user's words: "${goal.raw_input}")`,
    `Deadline: ${goal.deadline ?? "none"} · Daily time budget: ${goal.minutes_per_day} min`,
    goal.feasibility ? `Feasibility: ${goal.feasibility.verdict} (${goal.feasibility.score}/100). ${goal.feasibility.reasons.slice(0, 2).join(" ")}` : "",
    (goal.context?.answers ?? []).length ? `Background: ${(goal.context.answers ?? []).map((a) => `${a.question} ${a.answer}`).join(" | ")}` : "",
    "",
    "ROADMAP:",
    ...phases.map((p) => {
      const ms = milestones.filter((m) => m.phase_id === p.id);
      return `${p.idx + 1}. ${p.title} (${p.start_date} → ${p.end_date})${p.id === phase?.id ? " ← CURRENT" : ""}; milestones: ${ms.map((m) => `${m.title}${m.completed_at ? " ✓" : ""}`).join("; ")}`;
    }),
    phase ? `Current phase weekly targets: ${phase.weekly_targets.join("; ")}` : "",
    "",
    `PROGRESS: last 14 days ${rate.done}/${rate.planned} planned tasks done (${Math.round(rate.rate * 100)}%). Streak: ${streak.current} days (best ${streak.longest}).`,
    `TODAY'S TASKS: ${todays.length ? todays.map((t) => `[${t.status}] ${t.title} (${formatMinutes(t.estimated_minutes)}, ${t.difficulty})`).join("; ") : "none"}`,
    `NEXT 7 DAYS: ${next.slice(0, 10).map((t) => `${t.scheduled_date}: ${t.title}`).join("; ") || "nothing scheduled yet"}`,
    `RECENT CHECK-INS: ${checkins.map((c) => `${c.date} energy ${c.energy}/5 mood ${c.mood}/5${c.blocker ? ` blocker "${c.blocker}"` : ""}`).join("; ") || "none"}`,
    `RECENT REPLANS: ${replans.map((r) => r.summary).join(" | ") || "none"}`,
  ];
  return { goal, context: lines.filter((l) => l !== "").join("\n"), todayTitles: todays.filter((t) => t.status === "pending").map((t) => t.title) };
}
