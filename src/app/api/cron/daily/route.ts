import { NextResponse } from "next/server";
import { db, withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { env } from "@/lib/env";
import { reseedDemo } from "@/lib/seed/demo";
import { extendHorizon, needsExtension } from "@/lib/services/planning";
import { autoReplanAll } from "@/lib/services/replanning";
import { scheduledReviews } from "@/lib/services/reviews";
import { todayIn } from "@/lib/core/dates";

export const maxDuration = 300;

/**
 * Daily job (Vercel Cron, see vercel.json). For every user with active goals:
 * rebalance missed work, extend the rolling task horizon, and write weekly/monthly reviews.
 * Also refreshes the public demo account so its history stays relative to today.
 */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const report = { users: 0, replans: 0, extended: 0, reviews: 0, demo: false, errors: [] as string[] };

  try {
    await reseedDemo();
    report.demo = true;
  } catch (e) {
    report.errors.push(`demo: ${(e as Error).message}`);
  }

  const users = await db()`
    select distinct g.user_id from goals g join profiles p on p.id = g.user_id
    where g.status = 'active' and p.is_demo = false limit 200`;
  for (const { user_id } of users) {
    if (Date.now() - started > 250_000) break; // stay inside the function time limit
    const userId = user_id as string;
    report.users++;
    try {
      report.replans += await withUser(userId, (tx) => autoReplanAll(tx, userId));
      const goals = await withUser(userId, async (tx) => {
        const today = todayIn((await repo.getProfile(tx, userId)).timezone);
        const out: string[] = [];
        for (const g of (await repo.listGoals(tx)).filter((g) => g.status === "active")) {
          if (needsExtension(g, await repo.tasksForGoal(tx, g.id), today)) out.push(g.id);
        }
        return out;
      });
      for (const gid of goals) if ((await extendHorizon(userId, gid))?.added) report.extended++;
      report.reviews += await scheduledReviews(userId);
    } catch (e) {
      report.errors.push(`${userId.slice(0, 8)}: ${(e as Error).message}`);
    }
  }
  return NextResponse.json({ ok: true, ms: Date.now() - started, ...report });
}
