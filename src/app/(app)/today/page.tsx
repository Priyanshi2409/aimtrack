import { CalendarCheck, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckinCard } from "@/components/app/checkin-card";
import { ReplanNotices } from "@/components/app/replan-notice";
import { HorizonExtender } from "@/components/app/small-actions";
import { TaskItem } from "@/components/app/task-item";
import { TodayBoard } from "@/components/app/today-board";
import { Nudges, PageHeader, SectionTitle } from "@/components/app/widgets";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDate } from "@/lib/core/dates";
import { pullAhead } from "@/lib/core/replan";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { needsExtension } from "@/lib/services/planning";
import { loadInsights } from "@/lib/services/insights";
import { autoReplanAll } from "@/lib/services/replanning";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    await autoReplanAll(tx, user.id);
    const insights = await loadInsights(tx, user.id);
    const replans = await repo.replanEvents(tx, { unseenOnly: true, limit: 3 });
    return { ...insights, replans };
  });
  const { goals, tasks, today, streak, todayCheckin, nudges } = data;
  const active = goals.filter((g) => g.status === "active");
  const tomorrow = addDays(today, 1);

  const groups = active
    .map((g) => {
      const gTasks = tasks.filter((t) => t.goal_id === g.id);
      const todays = gTasks.filter((t) => t.scheduled_date === today);
      // Offer "pull forward" as if all of today's tasks were done.
      const simulated = gTasks.map((t) => (t.scheduled_date === today && t.status === "pending" ? { ...t, status: "done" as const } : t));
      const ahead = pullAhead(simulated, { today, capacityMinutes: g.minutes_per_day });
      return {
        goal: { id: g.id, title: g.title, color: g.color },
        tasks: todays,
        ahead: ahead.moves.length ? { count: ahead.moves.length, minutes: gTasks.filter((t) => ahead.moves.some((m) => m.taskId === t.id)).reduce((s, t) => s + t.estimated_minutes, 0) } : null,
      };
    })
    .filter((g) => g.tasks.length > 0);

  const upcoming = tasks.filter((t) => t.scheduled_date === tomorrow && t.status === "pending");
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const extend = active.filter((g) => needsExtension(g, tasks.filter((t) => t.goal_id === g.id), today)).map((g) => g.id);

  return (
    <>
      <PageHeader title="Today" subtitle={formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <HorizonExtender goalIds={extend} />
      <ReplanNotices events={data.replans} goalTitles={Object.fromEntries(goals.map((g) => [g.id, g.title]))} />

      {active.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck />}
          title="No active goals"
          body="Create a goal and today's tasks will show up here."
          action={
            <Button asChild>
              <Link href="/goals/new">
                <Plus /> New goal
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            {groups.length ? (
              <TodayBoard groups={groups} streak={streak} />
            ) : (
              <EmptyState icon={<CalendarCheck />} title="Nothing scheduled today" body="A planned rest day. Recovery is part of the plan." />
            )}
            {upcoming.length > 0 && (
              <section>
                <SectionTitle>Tomorrow</SectionTitle>
                <Card className="p-1.5 opacity-80">
                  {upcoming.map((t) => (
                    <TaskItem key={t.id} task={t} goal={goalById.get(t.goal_id)} />
                  ))}
                </Card>
              </section>
            )}
          </div>
          <aside className="space-y-4">
            <CheckinCard existing={todayCheckin} />
            <Nudges nudges={nudges} stacked />
          </aside>
        </div>
      )}
    </>
  );
}
