"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { Feather, FastForward, Flame, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { lightenTodayAction, pullAheadAction } from "@/app/actions/tracking";
import { TaskItem } from "@/components/app/task-item";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Card, Progress } from "@/components/ui/primitives";
import { formatMinutes } from "@/lib/core/dates";
import type { Task } from "@/lib/types";
import { cn, goalColor } from "@/lib/utils";

interface Group {
  goal: { id: string; title: string; color: string };
  tasks: Task[];
  ahead: { count: number; minutes: number } | null;
}

function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const end = Date.now() + 700;
  const colors = ["#c6f432", "#ff7a4d", "#5cc8ff", "#a891ff"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function TodayBoard({ groups, streak }: { groups: Group[]; streak: { current: number; todayDone: boolean } }) {
  const all = groups.flatMap((g) => g.tasks).filter((t) => t.status !== "skipped");
  const [doneIds, setDoneIds] = useState(() => new Set(all.filter((t) => t.status === "done").map((t) => t.id)));
  const [celebrated, setCelebrated] = useState(false);
  const [streakBumped, setStreakBumped] = useState(false);
  const total = all.length;
  const done = all.filter((t) => doneIds.has(t.id)).length;
  const remaining = all.filter((t) => !doneIds.has(t.id)).reduce((s, t) => s + t.estimated_minutes, 0);

  const onToggled = (id: string) => (isDone: boolean) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (isDone) next.add(id);
      else next.delete(id);
      const nowDone = all.filter((t) => next.has(t.id)).length;
      if (isDone && !streak.todayDone && prev.size === 0 && !streakBumped) {
        setStreakBumped(true);
        toast.success(`Streak extended to ${streak.current + 1} day${streak.current + 1 === 1 ? "" : "s"}!`, { icon: <Flame className="size-4 text-ember" /> });
      }
      if (isDone && nowDone === total && total > 0 && !celebrated) {
        setCelebrated(true);
        setTimeout(celebrate, 250);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="tabular font-mono text-3xl font-semibold tracking-tight">
              {done}
              <span className="text-subtle">/{total}</span>
            </div>
            <div className="text-xs text-subtle">{total === 0 ? "Nothing scheduled today" : remaining ? `${formatMinutes(remaining)} of work left` : "Everything done"}</div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
                streak.current + (streakBumped ? 1 : 0) > 0 ? "border-ember/30 bg-ember-soft text-ember" : "border-border text-muted",
              )}
            >
              <motion.span key={streakBumped ? "b" : "a"} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 12 }}>
                <Flame className={cn("size-4", (streak.todayDone || streakBumped) && "fill-ember")} />
              </motion.span>
              <span className="tabular font-mono">{streak.current + (streakBumped && !streak.todayDone ? 1 : 0)}</span>
            </div>
            <LightenDialog />
          </div>
        </div>
        <Progress value={total ? (done / total) * 100 : 0} className="mt-4" label="Today's progress" />
        <AnimatePresence>
          {total > 0 && done === total && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 rounded-xl bg-volt-soft px-3 py-2 text-sm">
              <PartyPopper className="size-4 text-volt-strong" /> Day complete. That&apos;s how plans turn into results.
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {groups.map(({ goal, tasks, ahead }) => (
        <section key={goal.id} aria-labelledby={`g-${goal.id}`}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={cn("size-2 rounded-full", goalColor(goal.color).dot)} />
            <h2 id={`g-${goal.id}`} className="text-sm font-semibold">
              {goal.title}
            </h2>
            <span className="text-xs text-subtle">
              {tasks.filter((t) => doneIds.has(t.id)).length}/{tasks.filter((t) => t.status !== "skipped").length}
            </span>
          </div>
          <Card className="p-1.5">
            {tasks.map((t) => (
              <TaskItem key={t.id} task={t} showGoal={false} onToggled={onToggled(t.id)} />
            ))}
          </Card>
          {ahead && tasks.every((t) => doneIds.has(t.id) || t.status === "skipped") && <AheadCard goalId={goal.id} count={ahead.count} minutes={ahead.minutes} />}
        </section>
      ))}
    </div>
  );
}

function AheadCard({ goalId, count, minutes }: { goalId: string; count: number; minutes: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-volt/30 bg-volt-soft px-4 py-3">
      <div className="text-sm">
        <span className="font-medium">You&apos;re ahead.</span>{" "}
        <span className="text-muted">
          Pull {count} task{count > 1 ? "s" : ""} ({formatMinutes(minutes)}) forward from upcoming days?
        </span>
      </div>
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await pullAheadAction(goalId);
            toast.success(r.summary || "Pulled forward");
            router.refresh();
          })
        }
      >
        <FastForward /> Pull forward
      </Button>
    </motion.div>
  );
}

function LightenDialog() {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Feather /> Lighten today
        </Button>
      </DialogTrigger>
      <DialogContent title="How much time do you have today?" description="I'll keep the most important tasks and move the rest to later days, without overloading them.">
        <div className="grid grid-cols-4 gap-2">
          {[15, 30, 60, 90].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={cn("rounded-xl border py-3 text-sm font-medium transition", minutes === m ? "border-volt-strong bg-volt-soft" : "border-border hover:border-border-strong")}
            >
              {formatMinutes(m)}
            </button>
          ))}
        </div>
        <Button
          className="mt-5 w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await lightenTodayAction(minutes);
              toast.success(r.summary, { duration: 6000 });
              setOpen(false);
              router.refresh();
            })
          }
        >
          Rebalance my day
        </Button>
      </DialogContent>
    </Dialog>
  );
}
