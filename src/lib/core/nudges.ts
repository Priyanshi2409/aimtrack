import { formatMinutes } from "./dates";

/**
 * Motivation nudges computed from the user's real data — never generic quotes.
 * Each rule returns at most one nudge; the highest-priority ones are shown.
 */
export interface NudgeInput {
  streak: { current: number; longest: number; todayDone: boolean };
  overdueCount: number;
  todayPending: number;
  todayMinutes: number;
  recentEnergy: number[]; // oldest → newest
  bestWeekday: { day: string; rate: number } | null;
  todayWeekday: string;
  lastWeekRate: number | null;
  prevWeekRate: number | null;
  topGoal?: { title: string; minutes: number } | null;
  daysSinceActive: number | null;
}

export interface Nudge {
  id: string;
  tone: "celebrate" | "encourage" | "warn" | "insight";
  text: string;
  priority: number;
}

export function computeNudges(i: NudgeInput, limit = 2): Nudge[] {
  const out: Nudge[] = [];
  const { current, longest, todayDone } = i.streak;

  if (current >= 3 && current === longest && todayDone) {
    out.push({ id: "record", tone: "celebrate", priority: 95, text: `${current}-day streak. That's your longest ever. Every day now sets a new record.` });
  } else if (current > 0 && longest > current && longest - current <= 2) {
    const gap = longest - current + 1;
    out.push({ id: "near-record", tone: "encourage", priority: 90, text: `${gap} more day${gap > 1 ? "s" : ""} and you beat your record of ${longest} days.` });
  } else if (current >= 2 && !todayDone && i.todayPending > 0) {
    out.push({ id: "protect", tone: "encourage", priority: 80, text: `Your ${current}-day streak is still alive. One task today keeps it going.` });
  }

  if (i.daysSinceActive !== null && i.daysSinceActive >= 2 && current === 0) {
    out.push({
      id: "comeback",
      tone: "encourage",
      priority: 85,
      text: `It's been ${i.daysSinceActive} days. Start with the smallest task on today's list. Getting back matters more than the gap.`,
    });
  }

  if (i.recentEnergy.length >= 3) {
    const last3 = i.recentEnergy.slice(-3);
    const avg = last3.reduce((s, e) => s + e, 0) / 3;
    if (avg <= 2.3) {
      out.push({ id: "energy", tone: "warn", priority: 88, text: `Your energy has been low for 3 check-ins (avg ${avg.toFixed(1)}/5), so I've trimmed today's load. Sleep is part of the plan too.` });
    }
  }

  if (i.overdueCount > 0) {
    out.push({ id: "overdue", tone: "warn", priority: 70, text: `${i.overdueCount} task${i.overdueCount > 1 ? "s" : ""} slipped. They've been spread over the next few days so no day gets overloaded.` });
  }

  if (i.lastWeekRate !== null && i.prevWeekRate !== null && i.lastWeekRate - i.prevWeekRate >= 0.15) {
    out.push({
      id: "improving",
      tone: "celebrate",
      priority: 75,
      text: `Last week you finished ${Math.round(i.lastWeekRate * 100)}% of your plan, up from ${Math.round(i.prevWeekRate * 100)}% the week before.`,
    });
  }

  if (i.bestWeekday && i.bestWeekday.day === i.todayWeekday && i.bestWeekday.rate >= 0.7) {
    out.push({ id: "best-day", tone: "insight", priority: 60, text: `${i.todayWeekday} is your strongest day (${Math.round(i.bestWeekday.rate * 100)}% done). Good day to tackle the hardest task.` });
  }

  if (i.topGoal && i.topGoal.minutes >= 120) {
    out.push({ id: "invested", tone: "insight", priority: 40, text: `You've put ${formatMinutes(i.topGoal.minutes)} into "${i.topGoal.title}". That's real progress already banked.` });
  }

  if (i.todayPending > 0 && i.todayMinutes > 0 && out.length === 0) {
    out.push({ id: "today", tone: "encourage", priority: 10, text: `Today's plan is ${formatMinutes(i.todayMinutes)} across ${i.todayPending} task${i.todayPending > 1 ? "s" : ""}. Start with the first one.` });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
