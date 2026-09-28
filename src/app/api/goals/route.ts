import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, parseBody, requireApiUser } from "@/lib/api";
import { addDays, todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { COLOR_KEYS } from "@/lib/utils";

const Body = z.object({
  raw: z.string().trim().min(8).max(500),
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().max(30).default("personal"),
  answers: z.array(z.object({ id: z.string().max(40), question: z.string().max(200), answer: z.string().trim().max(400) })).max(6),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  minutes_per_day: z.number().int().min(10).max(600),
  start: z.enum(["today", "tomorrow"]).default("today"),
});

/** Creates the goal row (status "researching") once the clarifying step is done. */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const b = await parseBody(req, Body);
    const goal = await withUser(user.id, async (tx) => {
      const profile = await repo.getProfile(tx, user.id);
      const today = todayIn(profile.timezone);
      if (b.deadline && b.deadline <= today) throw new z.ZodError([{ code: "custom", message: "The deadline must be in the future", path: ["deadline"], input: b.deadline }]);
      const count = (await repo.listGoals(tx)).length;
      return repo.createGoal(tx, user.id, {
        title: b.title,
        raw_input: b.raw,
        category: b.category,
        context: { answers: b.answers },
        deadline: b.deadline,
        minutes_per_day: b.minutes_per_day,
        start_date: b.start === "tomorrow" ? addDays(today, 1) : today,
        color: COLOR_KEYS[count % COLOR_KEYS.length],
      });
    });
    return NextResponse.json({ id: goal.id });
  } catch (e) {
    return errorResponse(e);
  }
}
