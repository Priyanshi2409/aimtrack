import type { Metadata } from "next";
import { CoachChat } from "@/components/app/coach-chat";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { isAiLive } from "@/lib/env";

export const metadata: Metadata = { title: "Coach" };

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const history = await withUser(user.id, (tx) => repo.coachHistory(tx, id, 60));
  return <CoachChat goalId={id} initial={history} live={isAiLive()} />;
}
