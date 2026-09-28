import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { env, isAiLive, isDbConfigured, isSupabaseAuth } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public, secret-free health check used by CI smoke tests. */
export async function GET() {
  const out: Record<string, unknown> = {
    ok: true,
    auth: isSupabaseAuth() ? "supabase" : "local",
    ai: isAiLive() ? { provider: "anthropic", smart: env.aiModelSmart, fast: env.aiModelFast } : "offline-templates",
    db: isDbConfigured() ? "configured" : "missing",
  };
  if (isDbConfigured()) {
    try {
      const rows = await db()`select name from public._migrations order by name`;
      out.migrations = rows.map((r) => r.name);
      const [demo] = await db()`select count(*)::int as n from goals g join profiles p on p.id = g.user_id where p.is_demo`;
      out.demoGoals = demo.n;
    } catch (e) {
      out.ok = false;
      out.dbError = (e as Error).message.slice(0, 120);
    }
  } else out.ok = false;
  return NextResponse.json(out, { status: out.ok ? 200 : 503 });
}
