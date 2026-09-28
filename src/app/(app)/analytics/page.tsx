import { BarChart3, CalendarCheck, Clock, Flame, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { MoodEnergyChart, PlannedVsActualChart, WeeklyCompletionChart } from "@/components/app/charts";
import { GenerateReviewButton, ReviewCard } from "@/components/app/reviews";
import { Heatmap, PageHeader, SectionTitle } from "@/components/app/widgets";
import { Card, CardBody, CardHeader, CardTitle, EmptyState, Progress, StatTile } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { formatMinutes } from "@/lib/core/dates";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { loadInsights } from "@/lib/services/insights";
import { cn, goalColor } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireUser();
  const { data, monthly } = await withUser(user.id, async (tx) => ({
    data: await loadInsights(tx, user.id),
    monthly: await repo.listReviews(tx, { kind: "monthly", limit: 1 }),
  }));
  const { streak, weeks, heat, pva, goalStats, checkins, totalMinutes, best } = data;
  const thisWeek = weeks[weeks.length - 1];
  const doneWeeks = weeks.filter((w) => w.planned > 0);
  const avgRate = doneWeeks.length ? doneWeeks.reduce((s, w) => s + w.rate, 0) / doneWeeks.length : 0;
  const maxMin = Math.max(1, ...goalStats.map((g) => g.minutes));

  if (data.goals.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState icon={<BarChart3 />} title="Nothing to analyse yet" body="Complete a few tasks and your consistency, streaks and time spent will show up here." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Analytics" subtitle="How consistent you are, where your time goes, and whether reality matches the plan." />
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Current streak" value={`${streak.current}d`} sub={streak.todayDone ? "Today counted" : "Do one task to extend"} icon={<Flame />} tone="ember" />
          <StatTile label="Longest streak" value={`${streak.longest}d`} sub="personal best" icon={<Trophy />} tone="iris" />
          <StatTile
            label="This week"
            value={thisWeek?.planned ? `${Math.round(thisWeek.rate * 100)}%` : "–"}
            sub={`12-week avg ${Math.round(avgRate * 100)}%`}
            icon={<CalendarCheck />}
            tone="volt"
          />
          <StatTile label="Total time" value={formatMinutes(totalMinutes)} sub={best ? `Best day: ${best.day} (${Math.round(best.rate * 100)}%)` : "logged on completed tasks"} icon={<Clock />} tone="sky" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consistency heatmap</CardTitle>
            <span className="text-xs text-subtle">tasks completed per day</span>
          </CardHeader>
          <CardBody>
            <Heatmap cells={heat} />
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Weekly completion rate</CardTitle>
              <span className="text-xs text-subtle">last 12 weeks · vs original plan</span>
            </CardHeader>
            <CardBody>
              <WeeklyCompletionChart data={weeks} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Planned vs actual time</CardTitle>
              <span className="text-xs text-subtle">last 14 days</span>
            </CardHeader>
            <CardBody>
              <PlannedVsActualChart data={pva} />
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Time spent per goal</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {goalStats.map((g) => (
                <div key={g.goal.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", goalColor(g.goal.color).dot)} />
                      <span className="truncate">{g.goal.title}</span>
                    </span>
                    <span className="font-mono text-xs text-muted">{formatMinutes(g.minutes)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-volt-strong" style={{ width: `${(g.minutes / maxMin) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Energy & mood</CardTitle>
              <span className="text-xs text-subtle">from daily check-ins</span>
            </CardHeader>
            <CardBody>
              {checkins.length >= 2 ? <MoodEnergyChart data={checkins} /> : <p className="py-10 text-center text-sm text-subtle">Do a few daily check-ins to see trends.</p>}
            </CardBody>
          </Card>
        </div>

        <section>
          <SectionTitle>Milestone progress</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {goalStats.map((g) => (
              <Card key={g.goal.id} className="p-5">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", goalColor(g.goal.color).dot)} />
                  <h3 className="truncate text-sm font-semibold">{g.goal.title}</h3>
                  <span className="ml-auto font-mono text-xs text-subtle">
                    {g.milestonesDone}/{g.milestonesTotal}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {g.phases.map((p) => (
                    <div key={p.id}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className={cn(p.id === g.currentPhase?.id ? "font-medium text-fg" : "text-muted")}>{p.title}</span>
                        <span className="font-mono text-subtle">
                          {p.milestonesDone}/{p.milestonesTotal}
                        </span>
                      </div>
                      <Progress value={p.milestonesTotal ? (p.milestonesDone / p.milestonesTotal) * 100 : 0} tone={p.id === g.currentPhase?.id ? "volt" : "sky"} label={`${p.title} milestones`} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle action={<GenerateReviewButton goalId={null} kind="monthly" period="current" label="This month so far" />}>Monthly report</SectionTitle>
          {monthly[0] ? (
            <ReviewCard r={monthly[0]} />
          ) : (
            <p className="text-sm text-subtle">Your first monthly report is written on the 1st of next month, or generate one now.</p>
          )}
        </section>

        <details className="rounded-2xl border border-border bg-surface p-5 text-sm">
          <summary className="cursor-pointer font-medium">Data table (accessible view)</summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-subtle">
                <tr>
                  <th className="py-1.5 pr-4 font-medium">Week of</th>
                  <th className="py-1.5 pr-4 font-medium">Planned</th>
                  <th className="py-1.5 pr-4 font-medium">Done</th>
                  <th className="py-1.5 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {weeks.map((w) => (
                  <tr key={w.week_start} className="border-t border-border">
                    <td className="py-1.5 pr-4">{w.week_start}</td>
                    <td className="py-1.5 pr-4">{w.planned}</td>
                    <td className="py-1.5 pr-4">{w.done}</td>
                    <td className="py-1.5">{w.planned ? `${Math.round(w.rate * 100)}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </>
  );
}
