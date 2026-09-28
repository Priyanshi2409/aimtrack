import { z } from "zod";
import { researchGoal } from "@/lib/ai/agents";
import { errorResponse, HttpError, ndjson, parseBody, requireApiUser, spendAiBudget } from "@/lib/api";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { goalContext } from "@/lib/services/planning";

export const maxDuration = 300;

const Body = z.object({ kind: z.enum(["examples", "requirements", "pitfalls"]), refresh: z.boolean().optional() });

/**
 * Research agent for one aspect of the goal. Streams live progress (search queries,
 * sources found, verification) as NDJSON. Results are cached per goal + kind.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const { kind, refresh } = await parseBody(req, Body);
    const snap = await withUser(user.id, async (tx) => {
      const goal = await repo.getGoal(tx, id);
      if (!goal) throw new HttpError(404, "Goal not found");
      const research = await repo.getResearch(tx, id);
      const tz = (await repo.getProfile(tx, user.id)).timezone;
      return { goal, research, today: todayIn(tz) };
    });

    const cached = snap.research.runs.find((r) => r.kind === kind);
    if (cached && !refresh) {
      return ndjson(async (send) => {
        send({ type: "status", text: "Using cached research for this goal" });
        return { cached: true, run: cached, findings: snap.research.findings.filter((f) => f.kind === kind) };
      });
    }
    await spendAiBudget(user.id, "research");

    return ndjson(async (send) => {
      const res = await researchGoal(kind, goalContext(snap.goal, snap.today), (e) => send(e));
      await withUser(user.id, (tx) => repo.saveResearch(tx, user.id, id, kind, res.data));
      const fresh = await withUser(user.id, (tx) => repo.getResearch(tx, id));
      return {
        cached: false,
        live: res.live,
        run: fresh.runs.find((r) => r.kind === kind),
        findings: fresh.findings.filter((f) => f.kind === kind),
        searches: res.data.searches,
      };
    });
  } catch (e) {
    return errorResponse(e);
  }
}
