"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Clock, ExternalLink, Search, SkipForward } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { logMinutes, skipTask, toggleTask } from "@/app/actions/tracking";
import { searchLink } from "@/lib/ai/urls";
import { formatDate, formatMinutes } from "@/lib/core/dates";
import type { Task } from "@/lib/types";
import { cn, goalColor, hostOf } from "@/lib/utils";

const DIFF = { easy: "text-volt-strong", medium: "text-sky", hard: "text-ember" } as const;

export function burst(origin?: { x: number; y: number }) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  confetti({ particleCount: 36, spread: 60, startVelocity: 26, scalar: 0.7, ticks: 90, origin: origin ?? { x: 0.5, y: 0.6 }, colors: ["#c6f432", "#ff7a4d", "#5cc8ff", "#a891ff"] });
}

export function TaskItem({
  task,
  goal,
  showGoal = true,
  showDate = false,
  onToggled,
  compact = false,
}: {
  task: Task;
  goal?: { title: string; color: string };
  showGoal?: boolean;
  showDate?: boolean;
  compact?: boolean;
  onToggled?: (done: boolean) => void;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(task.status === "done");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number>(task.actual_minutes ?? task.estimated_minutes);
  const skipped = task.status === "skipped";

  const toggle = (e: React.MouseEvent) => {
    const next = !optimisticDone;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    start(async () => {
      setOptimisticDone(next);
      if (next) burst({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight });
      try {
        await toggleTask(task.id, next, next ? minutes : null);
        onToggled?.(next);
      } catch {
        toast.error("Couldn't update the task. Check your connection and try again.");
      }
    });
  };

  return (
    <motion.div
      layout
      className={cn(
        "group rounded-xl border border-transparent transition-colors",
        open ? "border-border bg-surface-2" : "hover:bg-surface-2/70",
        skipped && "opacity-50",
      )}
    >
      <div className={cn("flex items-start gap-3", compact ? "px-2 py-2" : "px-3 py-3")}>
        <button
          type="button"
          onClick={toggle}
          disabled={pending || skipped}
          aria-pressed={optimisticDone}
          aria-label={optimisticDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className={cn(
            "relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-all duration-200",
            optimisticDone ? "border-volt bg-volt text-volt-fg" : "border-border-strong hover:border-volt-strong",
          )}
        >
          <AnimatePresence>
            {optimisticDone && (
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                <Check className="size-3.5" strokeWidth={3.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <div className={cn("text-sm font-medium leading-snug transition-colors", optimisticDone && "text-subtle line-through decoration-subtle/60")}>{task.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
            {showGoal && goal && (
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", goalColor(goal.color).dot)} />
                <span className="max-w-40 truncate">{goal.title}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {optimisticDone && task.actual_minutes ? `${formatMinutes(task.actual_minutes)} logged` : formatMinutes(task.estimated_minutes)}
            </span>
            <span className={cn("capitalize", DIFF[task.difficulty])}>{task.difficulty}</span>
            {showDate && <span>{formatDate(task.scheduled_date, { weekday: "short", day: "numeric", month: "short" })}</span>}
            {task.moved_count > 0 && <span className="text-ember">moved ×{task.moved_count}</span>}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-1 text-subtle opacity-60 transition hover:bg-surface-3 hover:text-fg group-hover:opacity-100"
          aria-label="Task details"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 px-3 pb-3 pl-12 text-sm">
              {task.why && (
                <p className="text-muted">
                  <span className="font-medium text-fg">Why it matters: </span>
                  {task.why}
                </p>
              )}
              {task.description && <p className="text-muted">{task.description}</p>}
              {(task.resource_url || task.resource_query) && (
                <a
                  href={task.resource_url ?? searchLink(task.resource_query!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg hover:border-border-strong"
                >
                  {task.resource_url ? (
                    <>
                      <ExternalLink className="size-3" /> {hostOf(task.resource_url)} <span className="text-subtle">(from research)</span>
                    </>
                  ) : (
                    <>
                      <Search className="size-3" /> Search: {task.resource_query}
                    </>
                  )}
                </a>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted">
                  Time spent
                  <input
                    type="number"
                    min={0}
                    max={960}
                    step={5}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
                    className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-sm text-fg"
                    aria-label="Minutes spent"
                  />
                  min
                </label>
                {optimisticDone && (
                  <button
                    type="button"
                    className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-surface-3"
                    onClick={() => start(async () => { await logMinutes(task.id, minutes); toast.success("Time logged"); })}
                  >
                    Save time
                  </button>
                )}
                {!optimisticDone && !skipped && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-subtle hover:bg-surface-3 hover:text-fg"
                    onClick={() => start(async () => { await skipTask(task.id); toast("Task skipped. It stays in your history as not done."); })}
                  >
                    <SkipForward className="size-3" /> Skip
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
