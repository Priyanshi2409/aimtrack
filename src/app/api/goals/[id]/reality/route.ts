import { NextResponse } from "next/server";
import { realityCheck } from "@/lib/ai/agents";
import { errorResponse, HttpError, requireApiUser, spendAiBudget } from "@/lib/api";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { goalContext } from "@/lib/services/planning";

export const maxDuration = 120;

/** Honest feasibility check using the verified research. Stored on the goal. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const snap = await withUser(user.id, async (tx) => {
      const goal = await repo.getGoal(tx, id);
      if (!goal) throw new HttpError(404, "Goal not found");
      const { findings } = await repo.getResearch(tx, id);
      const today = todayIn((await repo.getProfile(tx, user.id)).timezone);
      return { goal, findings, today };
    });
    await spendAiBudget(user.id, "reality");
    const res = await realityCheck(goalContext(snap.goal, snap.today), snap.findings);
    await withUser(user.id, (tx) => repo.updateGoal(tx, id, { feasibility: res.data, status: "planning" }));
    return NextResponse.json({ feasibility: res.data, live: res.live, deadline: snap.goal.deadline });
  } catch (e) {
    return errorResponse(e);
  }
}
