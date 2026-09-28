import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody, requireApiUser, spendAiBudget } from "@/lib/api";
import { startOfMonth, startOfWeek, todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { generateReview } from "@/lib/services/reviews";

export const maxDuration = 120;

const Body = z.object({
  goalId: z.string().uuid().nullable(),
  kind: z.enum(["weekly", "monthly"]),
  period: z.enum(["current", "previous"]).default("previous"),
});

/** On-demand weekly review or monthly report. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const b = await parseBody(req, Body);
    await spendAiBudget(user.id, "review", { log: false });
    const today = await withUser(user.id, async (tx) => todayIn((await repo.getProfile(tx, user.id)).timezone));
    const periodStart = b.period === "current" ? (b.kind === "weekly" ? startOfWeek(today) : startOfMonth(today)) : undefined;
    const r = await generateReview(user.id, { goalId: b.goalId, kind: b.kind, periodStart });
    return NextResponse.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}
