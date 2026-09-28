import { ArrowRight, CalendarCheck, Clock, Plus, Target, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReplanNotices } from "@/components/app/replan-notice";
import { HorizonExtender, LoadSamplesButton } from "@/components/app/small-actions";
import { TaskItem } from "@/components/app/task-item";
import { GoalCard, Heatmap, Nudges, PageHeader, SectionTitle, StreakChip } from "@/components/app/widgets";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Ring, StatTile } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDate, formatMinutes, startOfWeek } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { needsExtension } from "@/lib/services/planning";
import { loadInsights } from "@/lib/services/insights";
import { autoReplanAll } from "@/lib/services/replanning";
import { greeting } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    await autoReplanAll(tx, user.id);
    const insights = await loadInsights(tx, user.id);
    const replans = await repo.replanEvents(tx, { unseenOnly: true, limit: 3 });
    return { ...insights, replans };
  });

  const { goals, goalStats, todayTasks, streak, weeks, nudges, heat, today, profile } = data;
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const activeGoals = goals.filter((g) => g.status === "active");
  const pending = todayTasks.filter((t) => t.status === "pending");
  const done = todayTasks.filter((t) => t.status === "done");
  const todayPct = todayTasks.length ? Math.round((done.length / todayTasks.filter((t) => t.status !== "skipped").length) * 100) : 0;
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: profile.timezone }).format(new Date()));
  const name = (profile.display_name || "").split(" ")[0];
  const extend = activeGoals.filter((g) => needsExtension(g, data.tasks.filter((t) => t.goal_id === g.id), today)).map((g) => g.id);

  if (goals.length === 0) {
    return (
      <>
        <PageHeader title={`${greeting(hour)}${name ? `, ${name}` : ""}`} subtitle="Let's turn one goal into a plan you'll actually follow." />
        <EmptyState
          icon={<Target />}
          title="No goals yet"
          body="Write any goal in plain words. AimTrack researches how real people achieved it and builds a daily plan around your time."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/goals/new">
                  <Plus /> Create your first goal
                </Link>
              </Button>
              <LoadSamplesButton />
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting(hour)}${name ? `, ${name}` : ""}`}
        subtitle={formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
        action={<StreakChip current={streak.current} todayDone={streak.todayDone} />}
      />

      <HorizonExtender goalIds={extend} />
      <ReplanNotices events={data.replans} goalTitles={Object.fromEntries(goals.map((g) => [g.id, g.title]))} />

      <div className="space-y-8">
        <Nudges nudges={nudges} />

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ring value={todayPct} size={52}>
                  <span className="tabular font-mono text-xs font-semibold">{todayPct}%</span>
                </Ring>
                <div>
                  <h2 className="font-semibold">Today&apos;s focus</h2>
                  <p className="text-xs text-subtle">
                    {pending.length ? `${pending.length} left · ${formatMinutes(pending.reduce((s, t) => s + t.estimated_minutes, 0))}` : todayTasks.length ? "All done for today" : "Nothing scheduled"}
                  </p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/today">
                  Open Today <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="mt-3 -mx-2">
              {todayTasks.length === 0 && <p className="px-2 py-6 text-center text-sm text-subtle">A rest day. Enjoy it, or check upcoming tasks on your roadmap.</p>}
              {todayTasks.slice(0, 6).map((t) => (
                <TaskItem key={t.id} task={t} goal={goalById.get(t.goal_id)} compact />
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Current streak" value={streak.current} sub={`Best: ${streak.longest} days`} icon={<TrendingUp />} tone="ember" />
            <StatTile
              label="This week"
              value={thisWeek?.planned ? `${Math.round(thisWeek.rate * 100)}%` : "–"}
              sub={lastWeek?.planned ? `Last week ${Math.round(lastWeek.rate * 100)}%` : "of planned tasks done"}
              icon={<CalendarCheck />}
              tone="volt"
            />
            <StatTile label="Time invested" value={formatMinutes(data.totalMinutes)} sub="across all goals" icon={<Clock />} tone="sky" />
            <StatTile label="Active goals" value={activeGoals.length} sub={`${data.overdue.length} tasks overdue`} icon={<Target />} tone="iris" />
          </div>
        </div>

        <section>
          <SectionTitle
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/goals/new">
                  <Plus /> New goal
                </Link>
              </Button>
            }
          >
            Your goals
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goalStats
              .filter((s) => s.goal.status !== "archived")
              .map((s) => (
                <GoalCard
                  key={s.goal.id}
                  goal={s.goal}
                  phaseTitle={s.currentPhase?.title}
                  milestonesDone={s.milestonesDone}
                  milestonesTotal={s.milestonesTotal}
                  timeElapsedPct={s.timeElapsedPct}
                  weekRate={s.weekRate}
                  minutes={s.minutes}
                />
              ))}
          </div>
        </section>

        <section>
          <SectionTitle
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/analytics">
                  Analytics <ArrowRight />
                </Link>
              </Button>
            }
          >
            Consistency
          </SectionTitle>
          <Card className="p-5">
            <Heatmap cells={heat.filter((c) => c.date >= startOfWeek(addDays(today, -7 * 16)))} />
          </Card>
        </section>
      </div>
    </>
  );
}
