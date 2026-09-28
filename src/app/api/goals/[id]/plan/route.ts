import { z } from "zod";
import { generatePlan } from "@/lib/ai/agents";
import { errorResponse, HttpError, ndjson, parseBody, requireApiUser, spendAiBudget } from "@/lib/api";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { goalContext, materializePlan } from "@/lib/services/planning";

export const maxDuration = 300;

const Body = z.object({ deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() });

/** Generates the full roadmap (validated JSON) and writes phases/milestones/tasks. Streams progress. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await parseBody(req, Body);
    const snap = await withUser(user.id, async (tx) => {
      const goal = await repo.getGoal(tx, id);
      if (!goal) throw new HttpError(404, "Goal not found");
      const today = todayIn((await repo.getProfile(tx, user.id)).timezone);
      if (body.deadline !== undefined) {
        if (body.deadline && body.deadline <= today) throw new HttpError(400, "The deadline must be in the future");
        await repo.updateGoal(tx, id, { deadline: body.deadline, status: "planning" });
        goal.deadline = body.deadline;
      }
      const { findings } = await repo.getResearch(tx, id);
      return { goal, findings, today };
    });
    await spendAiBudget(user.id, "plan");

    return ndjson(async (send) => {
      send({ type: "progress", text: "Reading your research and constraints", pct: 5 });
      const start = snap.goal.start_date && snap.goal.start_date >= snap.today ? snap.goal.start_date : snap.today;
      const res = await generatePlan(goalContext(snap.goal, snap.today, start), snap.findings, (e) => send(e));
      send({ type: "progress", text: "Saving your roadmap", pct: 99 });
      await withUser(user.id, async (tx) => {
        await materializePlan(tx, user.id, snap.goal, res.data, start);
        await repo.updateGoal(tx, id, { ai_generated: res.live });
      });
      return { goalId: id, live: res.live, phases: res.data.phases.length, tasks: res.data.daily_tasks.length };
    });
  } catch (e) {
    return errorResponse(e);
  }
}
