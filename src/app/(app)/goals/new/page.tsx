import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoalWizard, type ResumeState } from "@/components/app/goal-wizard";
import { requireUser } from "@/lib/auth/session";
import { todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

export const metadata: Metadata = { title: "New goal" };

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const user = await requireUser();
  const { resume: resumeId } = await searchParams;
  const { today, resume } = await withUser(user.id, async (tx) => {
    const today = todayIn((await repo.getProfile(tx, user.id)).timezone);
    if (!resumeId) return { today, resume: null };
    const goal = await repo.getGoal(tx, resumeId);
    if (!goal) return { today, resume: null };
    if (goal.status === "active" || goal.status === "completed") redirect(`/goals/${goal.id}`);
    const { runs, findings } = await repo.getResearch(tx, goal.id);
    const state: ResumeState = {
      goalId: goal.id,
      title: goal.title,
      deadline: goal.deadline,
      minutes: goal.minutes_per_day,
      hasResearch: runs.map((r) => r.kind),
      feasibility: goal.feasibility,
      findings,
      runs,
    };
    return { today, resume: state };
  });
  return <GoalWizard today={today} resume={resume} key={resume?.goalId ?? "new"} />;
}
