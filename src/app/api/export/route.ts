import { NextResponse } from "next/server";
import { errorResponse, requireApiUser } from "@/lib/api";
import { withUser } from "@/lib/db/client";

/** Download all of the user's data as JSON (data portability). */
export async function GET() {
  try {
    const user = await requireApiUser();
    const data = await withUser(user.id, async (tx) => {
      const tables = ["profiles", "goals", "research_findings", "phases", "milestones", "tasks", "daily_checkins", "replan_events", "weekly_reviews", "coach_messages"];
      const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
      for (const t of tables) out[t] = await tx.unsafe(`select * from public.${t}`);
      return out;
    });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="aimtrack-export.json"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
