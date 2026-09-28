import { CheckCircle2, CircleDot, ExternalLink, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { MilestoneCheck } from "@/components/app/milestone-check";
import { ReplanNotices } from "@/components/app/replan-notice";
import { HorizonExtender } from "@/components/app/small-actions";
import { TaskItem } from "@/components/app/task-item";
import { SectionTitle } from "@/components/app/widgets";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDate, formatMinutes, todayIn } from "@/lib/core/dates";
import { progressOf } from "@/lib/core/stats";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { needsExtension } from "@/lib/services/planning";
import { autoReplanAll } from "@/lib/services/replanning";
import { cn, hostOf } from "@/lib/utils";

export default async function RoadmapPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const user = await requireUser();
  const data = await withUser(user.id, async (tx) => {
    await autoReplanAll(tx, user.id);
    const goal = (await repo.getGoal(tx, id))!;
    const today = todayIn((await repo.getProfile(tx, user.id)).timezone);
    const { phases, milestones } = await repo.getRoadmap(tx, id);
    const tasks = await repo.tasksForGoal(tx, id);
    const replans = await repo.replanEvents(tx, { goalId: id, unseenOnly: true, limit: 2 });
    return { goal, today, phases, milestones, tasks, replans };
  });
  const { goal, today, phases, milestones, tasks } = data;
  const upcoming = tasks.filter((t) => t.scheduled_date >= today && t.scheduled_date <= addDays(today, 13));
  const byDate = new Map<string, typeof upcoming>();
  for (const t of upcoming) byDate.set(t.scheduled_date, [...(byDate.get(t.scheduled_date) ?? []), t]);
  const msDone = milestones.filter((m) => m.completed_at).length;

  return (
    <div className="space-y-10">
      {created && (
        <div className="flex items-start gap-3 rounded-2xl border border-volt/30 bg-volt-soft px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 size-4 text-volt-strong" />
          <div>
            <span className="font-medium">Your roadmap is ready.</span>{" "}
            <span className="text-muted">
              Your first two weeks are scheduled below. Later weeks get planned as you go, based on how you&apos;re actually doing.{" "}
              <Link href="/today" className="font-medium text-fg underline underline-offset-4">
                Start today →
              </Link>
            </span>
          </div>
        </div>
      )}
      <HorizonExtender goalIds={goal.status === "active" && needsExtension(goal, tasks, today) ? [goal.id] : []} />
      <ReplanNotices events={data.replans} goalTitles={{ [goal.id]: goal.title }} />

      {goal.real_world_examples.length > 0 && (
        <section>
          <SectionTitle>People who did it</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {goal.real_world_examples.map((e) => (
              <Card key={e.source_url + e.summary} className="p-4">
                <p className="text-sm leading-relaxed">{e.summary}</p>
                <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky hover:underline">
                  <ExternalLink className="size-3" /> {hostOf(e.source_url)}
                </a>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle action={<span className="text-xs text-subtle">{msDone}/{milestones.length} milestones</span>}>Roadmap</SectionTitle>
        <ol className="relative space-y-4 pl-8 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-border">
          {phases.map((p) => {
            const state = today > p.end_date ? "past" : today >= p.start_date ? "current" : "future";
            const pm = milestones.filter((m) => m.phase_id === p.id);
            const pt = tasks.filter((t) => t.phase_id === p.id);
            const prog = progressOf(pt.filter((t) => t.scheduled_date <= today));
            const allMs = pm.length > 0 && pm.every((m) => m.completed_at);
            return (
              <li key={p.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-8 top-5 grid size-6 place-items-center rounded-full border-2 bg-bg",
                    allMs ? "border-volt bg-volt text-volt-fg" : state === "current" ? "border-volt-strong text-volt-strong" : "border-border text-subtle",
                  )}
                >
                  {allMs ? <CheckCircle2 className="size-3.5" /> : state === "current" ? <CircleDot className="size-3.5" /> : <span className="text-[10px] font-semibold">{p.idx + 1}</span>}
                </span>
                <Card className={cn("p-5", state === "current" && "border-volt/40")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          Phase {p.idx + 1}: {p.title}
                        </h3>
                        {state === "current" && <Badge tone="volt">Now</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-subtle">
                        {formatDate(p.start_date, { day: "numeric", month: "short" })} – {formatDate(p.end_date, { day: "numeric", month: "short", year: "numeric" })} · {p.duration_weeks} week{p.duration_weeks > 1 ? "s" : ""}
                      </p>
                      {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
                    </div>
                    {pt.length > 0 && (
                      <div className="w-32">
                        <div className="mb-1 flex justify-between text-[11px] text-subtle">
                          <span>Tasks</span>
                          <span className="font-mono">{prog.pct}%</span>
                        </div>
                        <Progress value={prog.pct} label={`${p.title} task progress`} />
                      </div>
                    )}
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr]">
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">Milestones</div>
                      {pm.map((m) => (
                        <MilestoneCheck key={m.id} m={m} overdue={Boolean(m.target_date && m.target_date < today)} />
                      ))}
                    </div>
                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">A typical week</div>
                      <ul className="space-y-1.5 text-sm text-muted">
                        {p.weekly_targets.map((w) => (
                          <li key={w} className="flex gap-2">
                            <Target className="mt-0.5 size-3.5 shrink-0 text-subtle" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <SectionTitle>Next two weeks</SectionTitle>
        {byDate.size === 0 ? (
          <p className="text-sm text-subtle">No tasks scheduled yet. The next week gets planned automatically.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[...byDate.entries()].map(([d, ts]) => (
              <Card key={d} className="p-2">
                <div className="flex items-center justify-between px-3 pb-1 pt-2">
                  <span className={cn("text-sm font-semibold", d === today && "text-volt-strong")}>
                    {d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : formatDate(d, { weekday: "long", day: "numeric", month: "short" })}
                  </span>
                  <span className="font-mono text-xs text-subtle">{formatMinutes(ts.reduce((s, t) => s + t.estimated_minutes, 0))}</span>
                </div>
                {ts.map((t) => (
                  <TaskItem key={t.id} task={t} showGoal={false} compact />
                ))}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
