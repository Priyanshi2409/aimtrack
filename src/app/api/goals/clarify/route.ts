import { NextResponse } from "next/server";
import { z } from "zod";
import { clarifyGoal } from "@/lib/ai/agents";
import { errorResponse, parseBody, requireApiUser, spendAiBudget } from "@/lib/api";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

export const maxDuration = 60;

const Body = z.object({ raw: z.string().trim().min(8, "Describe your goal in a few more words").max(500, "Keep it under 500 characters") });

/** Step 1 of the wizard: goal-specific clarifying questions. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const { raw } = await parseBody(req, Body);
    const tz = await withUser(user.id, async (tx) => (await repo.getProfile(tx, user.id)).timezone);
    await spendAiBudget(user.id, "clarify");
    const res = await clarifyGoal(raw, todayIn(tz));
    return NextResponse.json({ ...res.data, live: res.live, today: todayIn(tz) });
  } catch (e) {
    return errorResponse(e);
  }
}
