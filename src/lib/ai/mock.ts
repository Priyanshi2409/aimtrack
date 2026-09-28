import { addDays, diffDays } from "@/lib/core/dates";
import type { GoalContext } from "./prompts";
import type { ClarifyQuestions, FeasibilityOut, Plan, ReviewOut, NextTasks } from "./schemas";
import type { ReviewStats } from "@/lib/types";

/**
 * Offline fallback used ONLY when no AI key is configured (local dev / first deploy).
 * It is deliberately generic and clearly labelled in the UI; it never fabricates
 * research, people, sources or statistics.
 */

export function mockClarify(raw: string, today: string): ClarifyQuestions {
  const lower = raw.toLowerCase();
  const category: ClarifyQuestions["category"] = /run|marathon|gym|fit|weight|yoga/.test(lower)
    ? "fitness"
    : /caf|shop|startup|business|store|brand/.test(lower)
      ? "business"
      : /job|intern|pm|career|placement|role|promotion/.test(lower)
        ? "career"
        : /learn|course|exam|language|study/.test(lower)
          ? "learning"
          : "personal";
  const title = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    category,
    questions: [
      { id: "level", question: "Where are you starting from right now?", options: ["Complete beginner", "Some experience", "Intermediate", "Advanced"] },
      { id: "budget", question: "What budget can you put towards this?", options: ["₹0 (free only)", "Under ₹5,000", "₹5,000–50,000", "More than ₹50,000"] },
      { id: "constraints", question: "Any constraints I should plan around?", placeholder: "e.g. college exams in Nov, no weekends" },
    ],
    suggested_deadline: addDays(today, 90),
    suggested_minutes_per_day: 60,
  };
}

export function mockFeasibility(g: GoalContext): FeasibilityOut {
  const days = g.deadline ? diffDays(g.deadline, g.start_date) : 90;
  const hours = (days * g.minutes_per_day) / 60;
  const score = Math.max(15, Math.min(85, Math.round(20 + hours / 3)));
  return {
    score,
    verdict: score >= 70 ? "Achievable" : score >= 50 ? "Ambitious but doable" : score >= 30 ? "Very ambitious" : "Unrealistic in this timeframe",
    reasons: [
      `You have about ${Math.round(hours)} hours in total (${g.minutes_per_day} min/day for ${days} days).`,
      "This estimate is a rough offline heuristic. Live AI research isn't configured, so it isn't based on real-world data.",
    ],
    suggested_deadline: score < 30 ? addDays(g.start_date, Math.round(days * 1.6)) : null,
  };
}

const TEMPLATES: Record<string, { phases: [string, string[]][]; tasks: [string, string, number, "easy" | "medium" | "hard"][] }> = {
  default: {
    phases: [
      ["Foundations", ["Map what 'done' looks like", "Learn the core basics"]],
      ["Build momentum", ["Practise core skills daily", "Produce first tangible output"]],
      ["Push & prove", ["Do the hard, visible work", "Get outside feedback"]],
      ["Finish strong", ["Close gaps", "Deliver the final result"]],
    ],
    tasks: [
      ["Write down exactly what success looks like", "Clarity on the finish line makes every later decision easier.", 20, "easy"],
      ["Research 3 people who did this and note their first steps", "Borrowing proven paths saves months.", 40, "medium"],
      ["List the skills you need and rate yourself 1–5 on each", "Shows where the real gaps are.", 25, "easy"],
      ["Do one focused practice session on your weakest skill", "Weak spots compound if ignored.", 45, "medium"],
      ["Find one free resource for your weakest skill", "Removes friction for the coming weeks.", 20, "easy"],
      ["Produce a small first output (draft, run, prototype)", "Output beats planning.", 50, "hard"],
      ["Review the week: what worked, what didn't", "Weekly reflection keeps the plan honest.", 15, "easy"],
    ],
  },
};

export function mockPlan(g: GoalContext): Plan {
  const days = g.deadline ? Math.max(14, diffDays(g.deadline, g.start_date)) : 84;
  const totalWeeks = Math.max(2, Math.round(days / 7));
  const t = TEMPLATES.default;
  const nPhases = Math.min(t.phases.length, Math.max(2, Math.ceil(totalWeeks / 3)));
  const base = Math.floor(totalWeeks / nPhases);
  const phases = t.phases.slice(0, nPhases).map(([title, targets], i) => ({
    title,
    description: `Phase ${i + 1} of your plan for "${g.title}".`,
    duration_weeks: i === nPhases - 1 ? totalWeeks - base * (nPhases - 1) : base,
    milestones: [{ title: `${title} complete`, success_criteria: targets[targets.length - 1] }],
    weekly_targets: targets,
  }));
  const daily_tasks: Plan["daily_tasks"] = [];
  for (let day = 1; day <= 14; day++) {
    const [title, why, mins, difficulty] = t.tasks[(day - 1) % t.tasks.length];
    daily_tasks.push({
      day,
      title: day > 7 ? `${title} (week 2)` : title,
      description: "",
      why,
      estimated_minutes: Math.min(mins, g.minutes_per_day),
      difficulty,
      resource_url: null,
      resource_query: `${g.title} ${title}`.slice(0, 110),
      phase_index: 0,
      milestone_index: 0,
    });
  }
  return { feasibility: mockFeasibility(g), real_world_examples: [], phases, daily_tasks };
}

export function mockNextTasks(g: GoalContext, phaseIndex: number): NextTasks {
  const t = TEMPLATES.default.tasks;
  return {
    daily_tasks: Array.from({ length: 7 }, (_, i) => {
      const [title, why, mins, difficulty] = t[(i + 3) % t.length];
      return {
        day: i + 1,
        title,
        description: "",
        why,
        estimated_minutes: Math.min(mins, g.minutes_per_day),
        difficulty,
        resource_url: null,
        resource_query: `${g.title} ${title}`.slice(0, 110),
        phase_index: phaseIndex,
        milestone_index: null,
      };
    }),
  };
}

export function mockReview(stats: ReviewStats, goalTitle: string | null): ReviewOut {
  const pct = Math.round(stats.completion_rate * 100);
  const good = pct >= 70;
  return {
    summary: `${goalTitle ? `On "${goalTitle}" you` : "You"} completed ${stats.done} of ${stats.planned} planned tasks (${pct}%) and logged ${Math.round(
      stats.minutes / 60,
    )}h. ${good ? "Solid, consistent week." : "Below target, so next week's plan is lighter and more focused."}`,
    went_well: [
      ...(stats.streak >= 3 ? [`Kept a ${stats.streak}-day streak going`] : []),
      ...(stats.best_day ? [`${stats.best_day} was your most productive day`] : []),
      ...(good ? ["Finished most of what you planned"] : []),
    ].slice(0, 3),
    slipped: pct < 100 ? [`${stats.planned - stats.done} planned task(s) weren't completed`] : [],
    focus: good ? "Keep the same rhythm and start each day with the hardest task." : "Protect one fixed 30-minute slot every day for the first task on your list.",
  };
}

export function mockCoachReply(message: string, todayTitles: string[]): string {
  const first = todayTitles[0];
  return `(Offline coach: AI isn't configured, so this is a simple rule-based reply.)\n\n${
    first ? `Start with **${first}**. It's first on today's list.` : "You have nothing scheduled today. A good moment to review your roadmap."
  } If you're short on time, use **Lighten today** on the Today screen and I'll move the rest without overloading future days.`;
}
