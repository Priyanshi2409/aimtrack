"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { seedSampleGoals } from "@/lib/seed/sample";
import { applyAhead, lightenToday, replanGoal } from "@/lib/services/replanning";
import { COLOR_KEYS } from "@/lib/utils";

const uuid = z.string().uuid();

function refresh() {
  revalidatePath("/", "layout");
}

async function ctx() {
  const user = await requireUser();
  return user;
}

export async function toggleTask(taskId: string, done: boolean, actualMinutes?: number | null) {
  const user = await ctx();
  const id = uuid.parse(taskId);
  const mins = actualMinutes == null ? null : z.number().int().min(0).max(960).parse(actualMinutes);
  const res = await withUser(user.id, async (tx) => {
    const t = await repo.getTask(tx, id);
    if (!t) throw new Error("Task not found");
    await repo.setTaskStatus(tx, id, done ? "done" : "pending", done ? (mins ?? t.estimated_minutes) : null);
    return { ok: true };
  });
  refresh();
  return res;
}

export async function skipTask(taskId: string) {
  const user = await ctx();
  await withUser(user.id, (tx) => repo.setTaskStatus(tx, uuid.parse(taskId), "skipped", null));
  refresh();
}

export async function logMinutes(taskId: string, minutes: number) {
  const user = await ctx();
  await withUser(user.id, (tx) => repo.setActualMinutes(tx, uuid.parse(taskId), z.number().int().min(0).max(960).parse(minutes)));
  refresh();
}

const CheckinInput = z.object({
  energy: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5),
  blocker: z.string().trim().max(280).optional().nullable(),
});

export async function saveCheckin(input: z.infer<typeof CheckinInput>) {
  const user = await ctx();
  const c = CheckinInput.parse(input);
  await withUser(user.id, async (tx) => {
    const p = await repo.getProfile(tx, user.id);
    await repo.upsertCheckin(tx, user.id, { date: todayIn(p.timezone), energy: c.energy, mood: c.mood, blocker: c.blocker || null });
  });
  refresh();
}

export async function lightenTodayAction(minutes: number) {
  const user = await ctx();
  const m = z.number().int().min(10).max(600).parse(minutes);
  const results = await withUser(user.id, async (tx) => {
    const p = await repo.getProfile(tx, user.id);
    return lightenToday(tx, user.id, m, todayIn(p.timezone));
  });
  refresh();
  const moved = results.reduce((s, r) => s + r.moves.length, 0);
  return { moved, summary: results.filter((r) => r.moves.length).map((r) => r.summary).join(" ") || `Today already fits in ${m} minutes.` };
}

export async function replanGoalAction(goalId: string) {
  const user = await ctx();
  const r = await withUser(user.id, async (tx) => {
    const goal = await repo.getGoal(tx, uuid.parse(goalId));
    if (!goal) throw new Error("Goal not found");
    const p = await repo.getProfile(tx, user.id);
    return replanGoal(tx, user.id, goal, todayIn(p.timezone));
  });
  refresh();
  return { summary: r.summary, moved: r.moves.length };
}

export async function pullAheadAction(goalId: string) {
  const user = await ctx();
  const r = await withUser(user.id, async (tx) => {
    const goal = await repo.getGoal(tx, uuid.parse(goalId));
    if (!goal) throw new Error("Goal not found");
    const p = await repo.getProfile(tx, user.id);
    return applyAhead(tx, user.id, goal, todayIn(p.timezone));
  });
  refresh();
  return { summary: r.summary, moved: r.moves.length };
}

export async function dismissReplans(ids: string[]) {
  const user = await ctx();
  await withUser(user.id, (tx) => repo.markReplansSeen(tx, z.array(uuid).max(50).parse(ids)));
  refresh();
}

export async function toggleMilestone(milestoneId: string, done: boolean) {
  const user = await ctx();
  await withUser(user.id, (tx) => repo.setMilestoneDone(tx, uuid.parse(milestoneId), done));
  refresh();
}

const GoalPatch = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  minutes_per_day: z.number().int().min(10).max(600).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  color: z.enum(COLOR_KEYS as [string, ...string[]]).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

export async function updateGoalAction(goalId: string, patch: z.infer<typeof GoalPatch>) {
  const user = await ctx();
  const data = GoalPatch.parse(patch);
  await withUser(user.id, (tx) => repo.updateGoal(tx, uuid.parse(goalId), data));
  refresh();
}

export async function deleteGoalAction(goalId: string) {
  const user = await ctx();
  await withUser(user.id, (tx) => repo.deleteGoal(tx, uuid.parse(goalId)));
  refresh();
}

export async function updateProfileAction(patch: { display_name?: string; timezone?: string }) {
  const user = await ctx();
  const data = z
    .object({
      display_name: z.string().trim().min(1).max(60).optional(),
      timezone: z
        .string()
        .max(64)
        .refine((tz) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        }, "Unknown timezone")
        .optional(),
    })
    .parse(patch);
  await withUser(user.id, (tx) => repo.updateProfile(tx, user.id, data));
  refresh();
}

export async function loadSampleGoalsAction() {
  const user = await ctx();
  const n = await seedSampleGoals(user.id, { replace: false });
  refresh();
  return { created: n };
}

export async function clearCoachAction(goalId: string) {
  const user = await ctx();
  await withUser(user.id, (tx) => repo.clearCoach(tx, uuid.parse(goalId)));
  refresh();
}

export async function deleteAllDataAction() {
  const user = await ctx();
  await withUser(user.id, async (tx) => {
    await tx`delete from goals where user_id = ${user.id}`;
    await tx`delete from daily_checkins where user_id = ${user.id}`;
    await tx`delete from weekly_reviews where user_id = ${user.id}`;
  });
  refresh();
}
