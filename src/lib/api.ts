import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AIError } from "@/lib/ai/provider";
import { getUser, type SessionUser } from "@/lib/auth/session";
import { db, withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { isAiLive } from "@/lib/env";

/** Per-user daily AI budgets (cost control + abuse protection). */
const LIMITS: Record<string, number> = { clarify: 30, research: 30, reality: 15, plan: 12, coach: 100, extend: 30, review: 20 };
const DEMO_LIMITS: Record<string, number> = { clarify: 15, research: 9, reality: 5, plan: 3, coach: 40, extend: 10, review: 6 };
const GLOBAL_DAILY_CAP = Number(process.env.AI_DAILY_CALL_CAP ?? 500);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireApiUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Please sign in again.");
  return u;
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const r = schema.safeParse(json);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Invalid request");
  return r.data;
}

/** Throws 429 when the user (or the whole app) has used today's AI budget. Logs the call otherwise. */
export async function spendAiBudget(userId: string, kind: keyof typeof LIMITS, opts: { log?: boolean } = {}) {
  if (!isAiLive()) return; // offline templates cost nothing
  const [{ n: globalCount }] = await db()`select count(*)::int as n from ai_calls where created_at > now() - interval '24 hours'`;
  if ((globalCount as number) >= GLOBAL_DAILY_CAP) throw new HttpError(429, "AimTrack has hit its daily AI budget. Please try again tomorrow.");
  await withUser(userId, async (tx) => {
    const profile = await repo.getProfile(tx, userId);
    const limit = (profile.is_demo ? DEMO_LIMITS : LIMITS)[kind];
    const used = await repo.aiCallsSince(tx, kind, 24);
    if (used >= limit) {
      throw new HttpError(
        429,
        profile.is_demo
          ? `The shared demo account has used today's ${kind} budget. Create a free account to keep going.`
          : `You've reached today's limit for ${kind} (${limit}). It resets within 24 hours.`,
      );
    }
    if (opts.log !== false) await repo.logAiCall(tx, userId, kind); // some services log their own calls
  });
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof AIError) {
    const status = e.code === "rate_limited" ? 429 : e.code === "not_configured" || e.code === "search_unavailable" || e.code === "quota" ? 503 : 502;
    return NextResponse.json({ error: e.userMessage, code: e.code, retryable: e.retryable }, { status });
  }
  if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  console.error("[api] unexpected error", e);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

export function friendlyMessage(e: unknown): string {
  if (e instanceof HttpError) return e.message;
  if (e instanceof AIError) return e.userMessage;
  console.error("[stream] unexpected error", e);
  return "Something went wrong on our side. Please try again.";
}

/**
 * Newline-delimited JSON stream: lets long AI steps report live progress to the UI.
 * Each line is {type: ...}. The final line is {type:"done", ...} or {type:"error", error}.
 */
export function ndjson(run: (send: (obj: Record<string, unknown>) => void) => Promise<Record<string, unknown>>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* client went away */
        }
      };
      // Heartbeat keeps proxies from closing an idle connection during long model calls.
      const beat = setInterval(() => send({ type: "ping" }), 10_000);
      try {
        const result = await run(send);
        send({ type: "done", ...result });
      } catch (e) {
        send({ type: "error", error: friendlyMessage(e), code: e instanceof AIError ? e.code : undefined });
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
