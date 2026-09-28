import { Flame, Lightbulb, PartyPopper, TrendingUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import type { HeatCell } from "@/lib/core/stats";
import type { Nudge } from "@/lib/core/nudges";
import { formatDate, formatMinutes } from "@/lib/core/dates";
import type { Goal } from "@/lib/types";
import { cn, goalColor } from "@/lib/utils";

const NUDGE_STYLE = {
  celebrate: { icon: PartyPopper, cls: "border-volt/30 bg-volt-soft", iconCls: "text-volt-strong" },
  encourage: { icon: TrendingUp, cls: "border-sky/30 bg-sky-soft", iconCls: "text-sky" },
  warn: { icon: TriangleAlert, cls: "border-ember/30 bg-ember-soft", iconCls: "text-ember" },
  insight: { icon: Lightbulb, cls: "border-iris/30 bg-iris-soft", iconCls: "text-iris" },
};

export function Nudges({ nudges, stacked = false }: { nudges: Nudge[]; stacked?: boolean }) {
  if (!nudges.length) return null;
  return (
    <div className={cn("grid gap-3", !stacked && "sm:grid-cols-2")}>
      {nudges.map((n) => {
        const s = NUDGE_STYLE[n.tone];
        return (
          <div key={n.id} className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3", s.cls)}>
            <s.icon className={cn("mt-0.5 size-4 shrink-0", s.iconCls)} />
            <p className="text-sm leading-relaxed">{n.text}</p>
          </div>
        );
      })}
    </div>
  );
}

export function StreakChip({ current, todayDone }: { current: number; todayDone: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
        current > 0 ? "border-ember/30 bg-ember-soft text-ember" : "border-border bg-surface-2 text-muted",
      )}
      title={todayDone ? "Today counted" : "Complete a task today to extend your streak"}
    >
      <Flame className={cn("size-4", current > 0 && todayDone && "fill-ember")} />
      <span className="tabular font-mono">{current}</span>
      <span className="font-medium">day{current === 1 ? "" : "s"}</span>
    </div>
  );
}

const HEAT = ["bg-[var(--heat-0)]", "bg-[var(--heat-1)]", "bg-[var(--heat-2)]", "bg-[var(--heat-3)]", "bg-[var(--heat-4)]"];

/** GitHub-style consistency grid. Columns are weeks (Mon→Sun). */
export function Heatmap({ cells, className }: { cells: HeatCell[]; className?: string }) {
  const weeks: HeatCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const months: { idx: number; label: string }[] = [];
  weeks.forEach((w, i) => {
    const first = w[0];
    if (first && (i === 0 || first.date.slice(5, 7) !== weeks[i - 1][0].date.slice(5, 7))) months.push({ idx: i, label: formatDate(first.date, { month: "short" }) });
  });
  const active = cells.filter((c) => c.count > 0).length;
  return (
    <div className={className}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          <div className="relative mb-1 h-4 text-[10px] text-subtle">
            {months.map((m) => (
              <span key={m.idx} className="absolute" style={{ left: m.idx * 15 + 22 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 flex flex-col justify-between py-[1px] text-[9px] leading-none text-subtle">
              <span>Mon</span>
              <span>Thu</span>
              <span>Sun</span>
            </div>
            {weeks.map((w, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {w.map((c) => (
                  <div
                    key={c.date}
                    className={cn("size-3 rounded-[3px] transition-transform hover:scale-125", HEAT[c.level])}
                    title={`${formatDate(c.date, { weekday: "short", day: "numeric", month: "short" })}: ${c.count} task${c.count === 1 ? "" : "s"}${c.minutes ? ` · ${formatMinutes(c.minutes)}` : ""}`}
                    role="img"
                    aria-label={`${c.date}: ${c.count} tasks`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-subtle">
        <span>
          {active} active day{active === 1 ? "" : "s"} in the last {Math.round(cells.length / 7)} weeks
        </span>
        <span className="flex items-center gap-1">
          Less {HEAT.map((h, i) => <span key={i} className={cn("size-2.5 rounded-[2px]", h)} />)} More
        </span>
      </div>
    </div>
  );
}

export function VerdictBadge({ verdict, score }: { verdict?: string | null; score?: number | null }) {
  if (!verdict) return null;
  const tone = score == null ? "neutral" : score >= 70 ? "volt" : score >= 45 ? "sky" : score >= 30 ? "ember" : "danger";
  return (
    <Badge tone={tone as "volt"}>
      {verdict}
      {score != null && <span className="font-mono opacity-80">· {Math.round(score)}</span>}
    </Badge>
  );
}

export function GoalCard({
  goal,
  phaseTitle,
  milestonesDone,
  milestonesTotal,
  timeElapsedPct,
  weekRate,
  minutes,
}: {
  goal: Goal;
  phaseTitle?: string | null;
  milestonesDone: number;
  milestonesTotal: number;
  timeElapsedPct: number;
  weekRate?: { planned: number; done: number; rate: number };
  minutes: number;
}) {
  const c = goalColor(goal.color);
  const pct = milestonesTotal ? Math.round((milestonesDone / milestonesTotal) * 100) : 0;
  const setup = goal.status === "researching" || goal.status === "planning" || goal.status === "draft";
  return (
    <Link href={setup ? `/goals/new?resume=${goal.id}` : `/goals/${goal.id}`} className="group block">
      <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:border-border-strong">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl", c.soft)}>
            <span className={cn("size-2.5 rounded-full", c.dot)} />
          </div>
          {setup ? <Badge tone="iris">Setup unfinished</Badge> : <VerdictBadge verdict={goal.feasibility?.verdict} score={goal.feasibility?.score} />}
        </div>
        <h3 className="mt-4 line-clamp-2 font-semibold leading-snug tracking-tight">{goal.title}</h3>
        <p className="mt-1 truncate text-xs text-subtle">
          {setup ? "Tap to continue planning" : phaseTitle ? `Now: ${phaseTitle}` : goal.status === "completed" ? "Completed" : ""}
        </p>
        {!setup && (
          <>
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Milestones</span>
                <span className="tabular font-mono">
                  {milestonesDone}/{milestonesTotal}
                </span>
              </div>
              <Progress value={pct} label={`${goal.title} milestones`} />
              <div className="relative h-1">
                <span className="absolute -top-2 h-3 w-px bg-fg/40" style={{ left: `${timeElapsedPct}%` }} title={`${timeElapsedPct}% of time elapsed`} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-subtle">
              <span>{weekRate && weekRate.planned ? `${Math.round(weekRate.rate * 100)}% this week` : "No tasks due yet this week"}</span>
              <span>{formatMinutes(minutes)} invested</span>
            </div>
          </>
        )}
      </Card>
    </Link>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-subtle">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export { Card };
