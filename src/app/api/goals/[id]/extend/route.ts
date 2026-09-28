import { NextResponse } from "next/server";
import { errorResponse, requireApiUser, spendAiBudget } from "@/lib/api";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { extendHorizon, needsExtension } from "@/lib/services/planning";

export const maxDuration = 120;

/** Rolling horizon: generate the next week of tasks when a goal is running out. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const needed = await withUser(user.id, async (tx) => {
      const goal = await repo.getGoal(tx, id);
      if (!goal) return false;
      const today = todayIn((await repo.getProfile(tx, user.id)).timezone);
      return Boolean(needsExtension(goal, await repo.tasksForGoal(tx, id), today));
    });
    if (!needed) return NextResponse.json({ added: 0 });
    await spendAiBudget(user.id, "extend", { log: false });
    const r = await extendHorizon(user.id, id);
    return NextResponse.json({ added: r?.added ?? 0, live: r?.live ?? false });
  } catch (e) {
    return errorResponse(e);
  }
}
