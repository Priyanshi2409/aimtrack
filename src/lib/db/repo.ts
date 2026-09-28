import "server-only";
import type { ISODate } from "@/lib/core/dates";
import type { Move } from "@/lib/core/replan";
import type {
  Checkin,
  CoachMessage,
  Goal,
  Milestone,
  Phase,
  Profile,
  ReplanEvent,
  ResearchFinding,
  ResearchKind,
  ResearchRun,
  Review,
  Task,
} from "@/lib/types";
import type { Tx } from "./client";

/**
 * Data access layer. Every function takes a transaction opened by `withUser`, so RLS
 * scopes all reads/writes to the signed-in user; `user_id` is still written explicitly
 * and checked by the RLS `with check` clause.
 */

const TASK_FIELDS = [
  "id", "goal_id", "phase_id", "milestone_id", "title", "description", "why", "estimated_minutes", "difficulty",
  "resource_url", "resource_query", "scheduled_date", "original_date", "status", "completed_at", "actual_minutes",
  "sort_order", "moved_count",
];
const TASK_COLS = TASK_FIELDS.join(", ");
const TASK_COLS_T = TASK_FIELDS.map((f) => `t.${f}`).join(", ");

// ───────── profiles ─────────
export async function ensureProfile(tx: Tx, userId: string, displayName?: string | null): Promise<Profile> {
  const [row] = await tx`
    insert into profiles (id, display_name) values (${userId}, ${displayName ?? null})
    on conflict (id) do update set display_name = coalesce(profiles.display_name, excluded.display_name)
    returning id, display_name, timezone, is_demo, onboarded`;
  return row as unknown as Profile;
}

export async function getProfile(tx: Tx, userId: string): Promise<Profile> {
  const [row] = await tx`select id, display_name, timezone, is_demo, onboarded from profiles where id = ${userId}`;
  return (row as unknown as Profile) ?? ensureProfile(tx, userId);
}

export async function updateProfile(tx: Tx, userId: string, patch: Partial<Pick<Profile, "display_name" | "timezone" | "onboarded">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  await tx`update profiles set ${tx(patch as Record<string, unknown>, keys)} where id = ${userId}`;
}

// ───────── goals ─────────
export async function listGoals(tx: Tx, opts: { includeArchived?: boolean } = {}): Promise<Goal[]> {
  const rows = opts.includeArchived
    ? await tx`select * from goals order by created_at desc`
    : await tx`select * from goals where status <> 'archived' order by (status = 'active') desc, created_at desc`;
  return rows as unknown as Goal[];
}

export async function getGoal(tx: Tx, id: string): Promise<Goal | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await tx`select * from goals where id = ${id}`;
  return (row as unknown as Goal) ?? null;
}

export async function createGoal(
  tx: Tx,
  userId: string,
  g: Pick<Goal, "title" | "raw_input" | "category" | "context" | "deadline" | "minutes_per_day" | "start_date" | "color">,
): Promise<Goal> {
  const [row] = await tx`
    insert into goals (user_id, title, raw_input, category, context, deadline, minutes_per_day, start_date, color, status)
    values (${userId}, ${g.title}, ${g.raw_input}, ${g.category}, ${tx.json(g.context as never)}, ${g.deadline}, ${g.minutes_per_day},
            ${g.start_date}, ${g.color}, 'researching')
    returning *`;
  return row as unknown as Goal;
}

export async function updateGoal(tx: Tx, id: string, patch: Partial<Omit<Goal, "id" | "user_id" | "created_at">>) {
  const data: Record<string, unknown> = { ...patch, updated_at: new Date() };
  for (const k of ["context", "feasibility", "real_world_examples"] as const) {
    if (k in data && data[k] !== null) data[k] = tx.json(data[k] as never);
  }
  const keys = Object.keys(data);
  await tx`update goals set ${tx(data, keys)} where id = ${id}`;
}

export async function deleteGoal(tx: Tx, id: string) {
  await tx`delete from goals where id = ${id}`;
}

// ───────── research ─────────
export async function getResearch(tx: Tx, goalId: string): Promise<{ runs: ResearchRun[]; findings: ResearchFinding[] }> {
  const runs = await tx`select kind, status, note, searched_urls, dropped_count from research_runs where goal_id = ${goalId}`;
  const findings = await tx`select * from research_findings where goal_id = ${goalId} order by kind, created_at`;
  return { runs: runs as unknown as ResearchRun[], findings: findings as unknown as ResearchFinding[] };
}

export async function saveResearch(
  tx: Tx,
  userId: string,
  goalId: string,
  kind: ResearchKind,
  out: { items: { title: string; summary: string; details: Record<string, unknown>; source_url: string; source_title: string | null }[]; note: string | null; searchedUrls: string[]; dropped: number },
) {
  await tx`delete from research_findings where goal_id = ${goalId} and kind = ${kind}`;
  for (const it of out.items) {
    await tx`insert into research_findings (goal_id, user_id, kind, title, summary, detail, source_url, source_title)
             values (${goalId}, ${userId}, ${kind}, ${it.title}, ${it.summary}, ${tx.json(it.details as never)}, ${it.source_url}, ${it.source_title})`;
  }
  await tx`
    insert into research_runs (goal_id, user_id, kind, status, note, searched_urls, dropped_count)
    values (${goalId}, ${userId}, ${kind}, 'done', ${out.note}, ${tx.json(out.searchedUrls)}, ${out.dropped})
    on conflict (goal_id, kind) do update set status = 'done', note = excluded.note,
      searched_urls = excluded.searched_urls, dropped_count = excluded.dropped_count, created_at = now()`;
}

// ───────── roadmap ─────────
export async function getRoadmap(tx: Tx, goalId: string) {
  const phases = (await tx`select * from phases where goal_id = ${goalId} order by idx`) as unknown as Phase[];
  const milestones = (await tx`select * from milestones where goal_id = ${goalId} order by idx`) as unknown as Milestone[];
  return { phases, milestones };
}

export async function clearPlan(tx: Tx, goalId: string) {
  await tx`delete from tasks where goal_id = ${goalId}`;
  await tx`delete from phases where goal_id = ${goalId}`;
}

export async function insertPhase(tx: Tx, userId: string, goalId: string, p: Omit<Phase, "id" | "goal_id">): Promise<string> {
  const [row] = await tx`
    insert into phases (goal_id, user_id, idx, title, description, duration_weeks, start_date, end_date, weekly_targets)
    values (${goalId}, ${userId}, ${p.idx}, ${p.title}, ${p.description}, ${p.duration_weeks}, ${p.start_date}, ${p.end_date}, ${tx.json(p.weekly_targets)})
    returning id`;
  return row.id as string;
}

export async function insertMilestone(tx: Tx, userId: string, goalId: string, phaseId: string, m: { idx: number; title: string; success_criteria: string; target_date: ISODate | null }): Promise<string> {
  const [row] = await tx`
    insert into milestones (phase_id, goal_id, user_id, idx, title, success_criteria, target_date)
    values (${phaseId}, ${goalId}, ${userId}, ${m.idx}, ${m.title}, ${m.success_criteria}, ${m.target_date}) returning id`;
  return row.id as string;
}

export async function setMilestoneDone(tx: Tx, id: string, done: boolean) {
  await tx`update milestones set completed_at = ${done ? new Date() : null} where id = ${id}`;
}

export type NewTask = Omit<Task, "id" | "status" | "completed_at" | "actual_minutes" | "moved_count" | "original_date"> & { original_date?: ISODate };

export async function insertTasks(tx: Tx, userId: string, tasks: NewTask[]) {
  for (const t of tasks) {
    await tx`
      insert into tasks (goal_id, user_id, phase_id, milestone_id, title, description, why, estimated_minutes, difficulty,
                         resource_url, resource_query, scheduled_date, original_date, sort_order)
      values (${t.goal_id}, ${userId}, ${t.phase_id}, ${t.milestone_id}, ${t.title}, ${t.description}, ${t.why}, ${t.estimated_minutes},
              ${t.difficulty}, ${t.resource_url}, ${t.resource_query}, ${t.scheduled_date}, ${t.original_date ?? t.scheduled_date}, ${t.sort_order})`;
  }
}

// ───────── tasks ─────────
export async function tasksForGoal(tx: Tx, goalId: string): Promise<Task[]> {
  return (await tx.unsafe(`select ${TASK_COLS} from tasks where goal_id = $1 order by scheduled_date, sort_order`, [goalId])) as unknown as Task[];
}

export async function allTasks(tx: Tx, opts: { since?: ISODate } = {}): Promise<Task[]> {
  const since = opts.since ?? "1970-01-01";
  return (await tx.unsafe(
    `select ${TASK_COLS} from tasks where (scheduled_date >= $1 or original_date >= $1) order by scheduled_date, sort_order`,
    [since],
  )) as unknown as Task[];
}

export async function tasksOn(tx: Tx, date: ISODate): Promise<Task[]> {
  return (await tx.unsafe(
    `select ${TASK_COLS_T} from tasks t join goals g on g.id = t.goal_id
     where t.scheduled_date = $1 and g.status = 'active' order by t.sort_order, t.created_at`,
    [date],
  )) as unknown as Task[];
}

export async function getTask(tx: Tx, id: string): Promise<Task | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await tx.unsafe(`select ${TASK_COLS} from tasks where id = $1`, [id]);
  return (row as unknown as Task) ?? null;
}

export async function setTaskStatus(tx: Tx, id: string, status: Task["status"], actualMinutes: number | null) {
  await tx`
    update tasks set status = ${status},
      completed_at = ${status === "done" ? new Date() : null},
      actual_minutes = ${status === "done" ? actualMinutes : null}
    where id = ${id}`;
}

export async function setActualMinutes(tx: Tx, id: string, minutes: number) {
  await tx`update tasks set actual_minutes = ${minutes} where id = ${id} and status = 'done'`;
}

export async function applyMoves(tx: Tx, moves: Move[]) {
  for (const m of moves) {
    await tx`update tasks set scheduled_date = ${m.to}, moved_count = moved_count + ${m.to > m.from ? 1 : 0} where id = ${m.taskId}`;
  }
}

// ───────── check-ins ─────────
export async function upsertCheckin(tx: Tx, userId: string, c: Omit<Checkin, "id">) {
  await tx`
    insert into daily_checkins (user_id, date, energy, mood, blocker) values (${userId}, ${c.date}, ${c.energy}, ${c.mood}, ${c.blocker})
    on conflict (user_id, date) do update set energy = excluded.energy, mood = excluded.mood, blocker = excluded.blocker`;
}

export async function recentCheckins(tx: Tx, limit = 14): Promise<Checkin[]> {
  const rows = await tx`select id, date, energy, mood, blocker from daily_checkins order by date desc limit ${limit}`;
  return (rows as unknown as Checkin[]).reverse();
}

export async function checkinsBetween(tx: Tx, from: ISODate, to: ISODate): Promise<Checkin[]> {
  return (await tx`select id, date, energy, mood, blocker from daily_checkins where date between ${from} and ${to} order by date`) as unknown as Checkin[];
}

// ───────── replan events ─────────
export async function insertReplanEvent(tx: Tx, userId: string, goalId: string, e: Pick<ReplanEvent, "kind" | "summary" | "changes">) {
  await tx`insert into replan_events (goal_id, user_id, kind, summary, changes)
           values (${goalId}, ${userId}, ${e.kind}, ${e.summary}, ${tx.json(e.changes as never)})`;
}

export async function replanEvents(tx: Tx, opts: { goalId?: string; unseenOnly?: boolean; limit?: number } = {}): Promise<ReplanEvent[]> {
  const rows = await tx`
    select * from replan_events
    where (${opts.goalId ?? null}::uuid is null or goal_id = ${opts.goalId ?? null}::uuid)
      and (${opts.unseenOnly ?? false} = false or seen = false)
    order by created_at desc limit ${opts.limit ?? 10}`;
  return rows as unknown as ReplanEvent[];
}

export async function markReplansSeen(tx: Tx, ids: string[]) {
  if (ids.length) await tx`update replan_events set seen = true where id in ${tx(ids)}`;
}

// ───────── reviews ─────────
export async function upsertReview(tx: Tx, userId: string, r: Omit<Review, "id" | "created_at">) {
  await tx`
    delete from weekly_reviews where kind = ${r.kind} and period_start = ${r.period_start}
      and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${r.goal_id}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`;
  await tx`
    insert into weekly_reviews (user_id, goal_id, kind, period_start, period_end, stats, content, ai_generated)
    values (${userId}, ${r.goal_id}, ${r.kind}, ${r.period_start}, ${r.period_end}, ${tx.json(r.stats as never)}, ${tx.json(r.content as never)}, ${r.ai_generated})`;
}

export async function listReviews(tx: Tx, opts: { goalId?: string | null; kind?: "weekly" | "monthly"; limit?: number } = {}): Promise<Review[]> {
  const rows = await tx`
    select * from weekly_reviews
    where (${opts.goalId ?? null}::uuid is null or goal_id = ${opts.goalId ?? null}::uuid)
      and (${opts.kind ?? null}::text is null or kind = ${opts.kind ?? null}::text)
    order by period_start desc, created_at desc limit ${opts.limit ?? 12}`;
  return rows as unknown as Review[];
}

export async function hasReview(tx: Tx, goalId: string | null, kind: string, periodStart: ISODate) {
  const [row] = await tx`
    select 1 from weekly_reviews where kind = ${kind} and period_start = ${periodStart}
      and coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${goalId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`;
  return Boolean(row);
}

// ───────── coach ─────────
export async function coachHistory(tx: Tx, goalId: string, limit = 40): Promise<CoachMessage[]> {
  const rows = await tx`select * from coach_messages where goal_id = ${goalId} order by created_at desc limit ${limit}`;
  return (rows as unknown as CoachMessage[]).reverse();
}

export async function insertCoachMessage(tx: Tx, userId: string, goalId: string, role: "user" | "assistant", content: string) {
  await tx`insert into coach_messages (goal_id, user_id, role, content) values (${goalId}, ${userId}, ${role}, ${content.slice(0, 8000)})`;
}

export async function clearCoach(tx: Tx, goalId: string) {
  await tx`delete from coach_messages where goal_id = ${goalId}`;
}

// ───────── AI rate limiting ─────────
export async function aiCallsSince(tx: Tx, kind: string, hours: number): Promise<number> {
  const [row] = await tx`select count(*)::int as n from ai_calls where kind = ${kind} and created_at > now() - make_interval(hours => ${hours})`;
  return row.n as number;
}

export async function logAiCall(tx: Tx, userId: string, kind: string) {
  await tx`insert into ai_calls (user_id, kind) values (${userId}, ${kind})`;
}
