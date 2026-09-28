import type { Metadata } from "next";
import { GoalSettings } from "@/components/app/goal-settings";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

export const metadata: Metadata = { title: "Goal settings" };

export default async function GoalSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const goal = (await withUser(user.id, (tx) => repo.getGoal(tx, id)))!;
  return <GoalSettings goal={goal} />;
}
