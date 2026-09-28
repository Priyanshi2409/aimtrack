import { z } from "zod";
import { coachStream } from "@/lib/ai/agents";
import { getProvider } from "@/lib/ai";
import { mockCoachReply } from "@/lib/ai/mock";
import { errorResponse, friendlyMessage, HttpError, parseBody, requireApiUser, spendAiBudget } from "@/lib/api";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { buildCoachContext } from "@/lib/services/coach";

export const maxDuration = 120;

const Body = z.object({ message: z.string().trim().min(1, "Type a message").max(2000, "Keep messages under 2000 characters") });

/** AI coach for one goal. Streams plain text; both turns are stored. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const { message } = await parseBody(req, Body);
    const snap = await withUser(user.id, async (tx) => {
      const ctx = await buildCoachContext(tx, user.id, id);
      if (!ctx) throw new HttpError(404, "Goal not found");
      const history = await repo.coachHistory(tx, id, 16);
      await repo.insertCoachMessage(tx, user.id, id, "user", message);
      return { ...ctx, history };
    });
    await spendAiBudget(user.id, "coach");

    const provider = getProvider();
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let full = "";
        try {
          if (!provider) {
            full = mockCoachReply(message, snap.todayTitles);
            controller.enqueue(enc.encode(full));
          } else {
            const msgs = [...snap.history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }];
            for await (const chunk of coachStream(snap.context, msgs, provider)) {
              full += chunk;
              controller.enqueue(enc.encode(chunk));
            }
          }
          if (full.trim()) await withUser(user.id, (tx) => repo.insertCoachMessage(tx, user.id, id, "assistant", full));
        } catch (e) {
          const msg = `\n\n⚠️ ${friendlyMessage(e)}`;
          controller.enqueue(enc.encode(msg));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (e) {
    return errorResponse(e);
  }
}
