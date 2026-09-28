"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatMinutes } from "@/lib/core/dates";

/*
 * Chart conventions: one axis, thin marks with 4px rounded ends, recessive grid,
 * text in ink tokens (never series colour), hover tooltip on every chart.
 * Single-series charts need no legend (the card title names them).
 */
const AXIS = { fontSize: 11, fill: "var(--fg-subtle)" };

function TipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs shadow-lg">{children}</div>;
}

export function WeeklyCompletionChart({ data }: { data: { week_start: string; planned: number; done: number; rate: number }[] }) {
  const rows = data.map((d) => ({ ...d, pct: Math.round(d.rate * 100), label: formatDate(d.week_start) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={({ active, payload }) =>
            active && payload?.[0] ? (
              <TipBox>
                <div className="font-medium">Week of {String(payload[0].payload.label)}</div>
                <div className="text-muted">
                  {payload[0].payload.planned ? `${payload[0].payload.done}/${payload[0].payload.planned} tasks · ${payload[0].payload.pct}%` : "No tasks due"}
                </div>
              </TipBox>
            ) : null
          }
        />
        <Bar dataKey="pct" fill="var(--volt-strong)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlannedVsActualChart({ data }: { data: { date: string; planned: number; actual: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: formatDate(d.date, { day: "numeric", month: "short" }) }));
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[var(--fg-subtle)]" /> Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-volt-strong" /> Actual
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 60 ? `${Number((v / 60).toFixed(1))}h` : `${v}m`)} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TipBox>
                  <div className="font-medium">{String(payload[0].payload.label)}</div>
                  <div className="text-muted">Planned {formatMinutes(Number(payload[0].payload.planned))}</div>
                  <div className="text-muted">Actual {formatMinutes(Number(payload[0].payload.actual))}</div>
                </TipBox>
              ) : null
            }
          />
          <Bar dataKey="planned" fill="var(--surface-3)" stroke="var(--fg-subtle)" strokeWidth={1} strokeDasharray="3 2" radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Bar dataKey="actual" fill="var(--volt-strong)" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodEnergyChart({ data }: { data: { date: string; energy: number; mood: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: formatDate(d.date) }));
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-sky" /> Energy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-ember" /> Mood
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TipBox>
                  <div className="font-medium">{String(payload[0].payload.label)}</div>
                  <div className="text-muted">
                    Energy {String(payload[0].payload.energy)}/5 · Mood {String(payload[0].payload.mood)}/5
                  </div>
                </TipBox>
              ) : null
            }
          />
          <Line type="monotoneX" dataKey="energy" stroke="var(--sky)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--sky)" }} activeDot={{ r: 5 }} />
          <Line type="monotoneX" dataKey="mood" stroke="var(--ember)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, strokeWidth: 0, fill: "var(--ember)" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
