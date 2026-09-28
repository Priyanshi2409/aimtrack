import "server-only";
import type { ResearchKind, ReviewStats } from "@/lib/types";
import { fitToCapacity } from "@/lib/core/schedule";
import { getProvider } from "./index";
import * as mock from "./mock";
import * as P from "./prompts";
import type { AgentEvent, AIProvider, ChatMessage } from "./provider";
import {
  ClarifyQuestionsSchema,
  FeasibilitySchema,
  NextTasksSchema,
  PlanSchema,
  ResearchStepSchema,
  ReviewSchema,
  type ClarifyQuestions,
  type FeasibilityOut,
  type NextTasks,
  type Plan,
  type ReviewOut,
} from "./schemas";
import { generateStructured, generateStructuredStreaming, parseStructured } from "./structured";
import { verifySources } from "./urls";

type Finding = { kind: ResearchKind; title: string; summary: string; source_url: string };

export interface AgentResult<T> {
  data: T;
  live: boolean; // false = offline template (no AI key)
}

// ───────────── 1. Clarifying questions ─────────────
export async function clarifyGoal(raw: string, today: string): Promise<AgentResult<ClarifyQuestions>> {
  const p = getProvider();
  if (!p) return { data: mock.mockClarify(raw, today), live: false };
  const data = await generateStructured(p, ClarifyQuestionsSchema, {
    tier: "fast",
    system: P.CLARIFY_SYSTEM,
    messages: [{ role: "user", content: `Today is ${today}.\nGoal: "${raw}"` }],
    maxTokens: 900,
  });
  return { data, live: true };
}

// ───────────── 2. Research agent (web search + citation verification) ─────────────
export interface ResearchOutcome {
  items: { title: string; summary: string; details: Record<string, unknown>; source_url: string; source_title: string | null }[];
  note: string | null;
  searchedUrls: string[];
  dropped: number;
  searches: number;
}

export async function researchGoal(kind: ResearchKind, goal: P.GoalContext, onEvent: (e: AgentEvent) => void = () => {}): Promise<AgentResult<ResearchOutcome>> {
  const p = getProvider();
  if (!p) {
    onEvent({ type: "status", text: "Live research is off (no AI key configured)" });
    return {
      live: false,
      data: {
        items: [],
        note: "Live web research is not configured on this server, so no real-world sources were gathered. Nothing was made up to fill the gap.",
        searchedUrls: [],
        dropped: 0,
        searches: 0,
      },
    };
  }
  onEvent({ type: "status", text: "Planning search queries" });
  const res = await p.completeWithWebSearch({
    tier: "smart",
    system: P.researchSystem(kind),
    messages: [{ role: "user", content: P.researchUser(goal) }],
    maxSearches: 4,
    maxTokens: 3500,
    onEvent,
  });
  onEvent({ type: "status", text: "Checking every claim against the pages actually found" });

  let parsed = parseStructured(ResearchStepSchema, res.text);
  if (!parsed.ok) {
    // One repair pass WITHOUT searching again (cheap): reformat the findings into valid JSON.
    const fixed = await p.complete({
      tier: "fast",
      system: "You convert research notes into strict JSON. Keep only facts present in the notes, with their exact source URLs. Output ONLY JSON.",
      messages: [
        {
          role: "user",
          content: `Error in previous output: ${parsed.error}\nRequired shape: {"items":[{"title":string,"summary":string,"details":object,"source_url":string,"source_title":string}],"note":string|null}\n\nNotes:\n${res.text.slice(0, 12000)}`,
        },
      ],
      maxTokens: 3000,
    });
    parsed = parseStructured(ResearchStepSchema, fixed);
    if (!parsed.ok) {
      return {
        live: true,
        data: { items: [], note: "The research agent's output couldn't be verified, so it was discarded rather than shown unverified.", searchedUrls: res.sources.map((s) => s.url), dropped: 0, searches: res.searchCount },
      };
    }
  }

  // Anti-hallucination guard: keep only claims whose URL the search tool really returned.
  const { kept, dropped } = verifySources(parsed.data.items, res.sources.map((s) => s.url));
  onEvent({ type: "progress", text: `${kept.length} finding${kept.length === 1 ? "" : "s"} verified${dropped.length ? `, ${dropped.length} unverifiable removed` : ""}` });
  const titleFor = new Map(res.sources.map((s) => [s.url, s.title]));
  return {
    live: true,
    data: {
      items: kept.map((i) => ({
        title: i.title,
        summary: i.summary,
        details: i.details ?? {},
        source_url: i.source_url,
        source_title: i.source_title ?? titleFor.get(i.source_url) ?? null,
      })),
      note:
        kept.length === 0
          ? parsed.data.note || "No reliable sources were found for this part of the goal."
          : (parsed.data.note ?? null),
      searchedUrls: res.sources.map((s) => s.url),
      dropped: dropped.length,
      searches: res.searchCount,
    },
  };
}

// ───────────── 3. Reality check ─────────────
export async function realityCheck(goal: P.GoalContext, findings: Finding[]): Promise<AgentResult<FeasibilityOut>> {
  const p = getProvider();
  if (!p) return { data: mock.mockFeasibility(goal), live: false };
  const data = await generateStructured(p, FeasibilitySchema, {
    tier: "smart",
    system: P.REALITY_SYSTEM,
    messages: [{ role: "user", content: P.realityUser(goal, findings) }],
    maxTokens: 900,
  });
  return { data, live: true };
}

// ───────────── 4. Plan generator ─────────────
export async function generatePlan(goal: P.GoalContext, findings: Finding[], onEvent: (e: AgentEvent) => void = () => {}): Promise<AgentResult<Plan>> {
  const p = getProvider();
  if (!p) {
    onEvent({ type: "progress", text: "Building an offline template plan (no AI key configured)", pct: 60 });
    return { data: sanitizePlan(mock.mockPlan(goal), findings, goal.minutes_per_day), live: false };
  }
  let stage = "";
  const raw = await generateStructuredStreaming(
    p,
    PlanSchema,
    { tier: "smart", system: P.PLAN_SYSTEM, messages: [{ role: "user", content: P.planUser(goal, findings) }], maxTokens: 9000 },
    (snap) => {
      const phases = (snap.match(/"duration_weeks"/g) ?? []).length;
      const tasks = (snap.match(/"estimated_minutes"/g) ?? []).length;
      const next = tasks
        ? `Scheduling daily tasks (${tasks} so far)`
        : phases
          ? `Designing phase ${phases} with milestones and weekly targets`
          : snap.includes('"real_world_examples"')
            ? "Linking real-world examples"
            : "Assessing feasibility";
      if (next !== stage) {
        stage = next;
        onEvent({ type: "progress", text: next, pct: Math.min(95, tasks ? 55 + tasks * 2 : phases ? 20 + phases * 8 : 10) });
      }
    },
  );
  onEvent({ type: "progress", text: "Validating the plan and checking capacity per day", pct: 97 });
  return { data: sanitizePlan(raw, findings, goal.minutes_per_day), live: true };
}

/** Post-validation that Zod can't express: URL provenance, index bounds, capacity. */
export function sanitizePlan(plan: Plan, findings: Finding[], minutesPerDay: number): Plan {
  const allowed = findings.map((f) => f.source_url);
  const examples = verifySources(plan.real_world_examples, allowed).kept;
  const tasks = plan.daily_tasks.map((t) => {
    const phase_index = Math.min(Math.max(0, t.phase_index), plan.phases.length - 1);
    const ms = plan.phases[phase_index].milestones.length;
    const milestone_index = t.milestone_index == null ? null : Math.min(Math.max(0, t.milestone_index), ms - 1);
    const urlOk = t.resource_url && verifySources([{ source_url: t.resource_url }], allowed).kept.length > 0;
    return {
      ...t,
      phase_index,
      milestone_index,
      estimated_minutes: Math.min(t.estimated_minutes, Math.max(10, minutesPerDay)),
      resource_url: urlOk ? t.resource_url! : null,
      resource_query: urlOk ? null : (t.resource_query ?? t.title),
    };
  });
  return { ...plan, real_world_examples: examples, daily_tasks: fitToCapacity(tasks, minutesPerDay) };
}

// ───────────── 5. Rolling horizon: next week's tasks ─────────────
export async function generateNextWeek(
  goal: P.GoalContext,
  ctx: { phaseIndex: number; phaseTitle: string; weeklyTargets: string[]; milestones: string[]; recentDone: string[]; completionRate: number; findings: Finding[] },
): Promise<AgentResult<NextTasks>> {
  const p = getProvider();
  if (!p) return { data: mock.mockNextTasks(goal, ctx.phaseIndex), live: false };
  const data = await generateStructured(p, NextTasksSchema, {
    tier: "fast",
    system: P.NEXT_TASKS_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${P.describeGoal(goal)}
Current phase (index ${ctx.phaseIndex}): ${ctx.phaseTitle}
Weekly targets: ${ctx.weeklyTargets.join("; ")}
Milestones in this phase: ${ctx.milestones.join("; ")}
Recently completed tasks: ${ctx.recentDone.slice(0, 15).join("; ") || "none"}
Completion rate over the last 2 weeks: ${Math.round(ctx.completionRate * 100)}%
Research URLs you may use as resource_url: ${ctx.findings.map((f) => f.source_url).join(", ") || "none"}
Week starts: ${goal.start_date}. Generate the next 7 days.`,
      },
    ],
    maxTokens: 3500,
  });
  const allowed = ctx.findings.map((f) => f.source_url);
  data.daily_tasks = fitToCapacity(
    data.daily_tasks.map((t) => {
      const ok = t.resource_url && verifySources([{ source_url: t.resource_url }], allowed).kept.length > 0;
      return { ...t, phase_index: ctx.phaseIndex, resource_url: ok ? t.resource_url : null, resource_query: ok ? null : (t.resource_query ?? t.title) };
    }),
    goal.minutes_per_day,
  ).filter((t) => t.day <= 7);
  return { data, live: true };
}

// ───────────── 6. Weekly / monthly review ─────────────
export async function writeReview(input: {
  kind: "weekly" | "monthly";
  goalTitle: string | null;
  stats: ReviewStats;
  doneTitles: string[];
  missedTitles: string[];
  blockers: string[];
  replans: string[];
}): Promise<AgentResult<ReviewOut>> {
  const p = getProvider();
  if (!p) return { data: mock.mockReview(input.stats, input.goalTitle), live: false };
  const data = await generateStructured(p, ReviewSchema, {
    tier: "fast",
    system: P.REVIEW_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${input.kind === "monthly" ? "Monthly progress report" : "Weekly review"}${input.goalTitle ? ` for goal "${input.goalTitle}"` : " across all goals"}.
Stats: ${JSON.stringify(input.stats)}
Completed: ${input.doneTitles.slice(0, 20).join("; ") || "none"}
Missed/moved: ${input.missedTitles.slice(0, 15).join("; ") || "none"}
Blockers from check-ins: ${input.blockers.slice(0, 10).join("; ") || "none"}
Automatic replans: ${input.replans.slice(0, 5).join(" | ") || "none"}`,
      },
    ],
    maxTokens: 800,
  });
  return { data, live: true };
}

// ───────────── 7. Coach (streaming) ─────────────
export function coachStream(context: string, history: ChatMessage[], provider: AIProvider = getProvider()!): AsyncIterable<string> {
  return provider.stream({ tier: "fast", system: P.coachSystem(context), messages: history.slice(-16), maxTokens: 700 });
}
