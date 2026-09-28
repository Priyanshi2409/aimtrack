import { CalendarClock, Clock, Sparkles } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { GoalTabs, ReplanButton } from "@/components/app/goal-tabs";
import { VerdictBadge } from "@/components/app/widgets";
import { Badge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { diffDays, formatDate, formatMinutes, todayIn } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { cn, goalColor } from "@/lib/utils";

export default async function GoalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    const goal = await repo.getGoal(tx, id);
    if (!goal) return null;
    return { goal, today: todayIn((await repo.getProfile(tx, user.id)).timezone) };
  });
  if (!data) notFound();
  const { goal, today } = data;
  if (["draft", "researching", "planning"].includes(goal.status)) redirect(`/goals/new?resume=${goal.id}`);
  const c = goalColor(goal.color);
  const daysLeft = goal.deadline ? diffDays(goal.deadline, today) : null;

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("size-2.5 rounded-full", c.dot)} />
              <VerdictBadge verdict={goal.feasibility?.verdict} score={goal.feasibility?.score} />
              {goal.status !== "active" && <Badge>{goal.status}</Badge>}
              {!goal.ai_generated && (
                <Badge tone="iris">
                  <Sparkles className="size-3" /> Offline template
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{goal.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {goal.deadline && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4" /> {formatDate(goal.deadline, { day: "numeric", month: "short", year: "numeric" })}
                  {daysLeft != null && <span className="text-subtle">({daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days past`})</span>}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {formatMinutes(goal.minutes_per_day)}/day
              </span>
            </div>
          </div>
          {goal.status === "active" && <ReplanButton goalId={goal.id} />}
        </div>
      </header>
      <GoalTabs id={goal.id} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
