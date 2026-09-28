"use client";

import { Archive, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGoalAction, updateGoalAction } from "@/app/actions/tracking";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Card, Input, Label } from "@/components/ui/primitives";
import { formatMinutes } from "@/lib/core/dates";
import type { Goal } from "@/lib/types";
import { COLOR_KEYS, cn, goalColor } from "@/lib/utils";

export function GoalSettings({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [title, setTitle] = useState(goal.title);
  const [minutes, setMinutes] = useState(goal.minutes_per_day);
  const [deadline, setDeadline] = useState(goal.deadline ?? "");
  const [color, setColor] = useState(goal.color);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      try {
        await updateGoalAction(goal.id, { title, minutes_per_day: minutes, deadline: deadline || null, color });
        toast.success("Saved. Future replans use your new daily time.");
      } catch {
        toast.error("Couldn't save. Check the values and try again.");
      }
    });

  const setStatus = (status: "active" | "completed" | "archived") =>
    start(async () => {
      await updateGoalAction(goal.id, { status });
      toast.success(status === "completed" ? "Goal marked complete. Congratulations!" : status === "archived" ? "Goal archived" : "Goal reactivated");
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="space-y-5 p-5">
        <div className="space-y-2">
          <Label htmlFor="gt">Title</Label>
          <Input id="gt" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gm">Time per day: {formatMinutes(minutes)}</Label>
            <input id="gm" type="range" min={10} max={240} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-3 w-full accent-[var(--volt-strong)]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gd">Deadline</Label>
            <Input id="gd" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Colour</Label>
          <div className="flex gap-2">
            {COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn("grid size-9 place-items-center rounded-xl border", color === c ? "border-fg" : "border-border")}
              >
                <span className={cn("size-4 rounded-full", goalColor(c).dot)} />
              </button>
            ))}
          </div>
        </div>
        <Button onClick={save} loading={pending}>
          Save changes
        </Button>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Status</h3>
        {goal.status !== "completed" ? (
          <Button variant="secondary" className="w-full justify-start" onClick={() => setStatus("completed")}>
            <CheckCircle2 className="text-volt-strong" /> Mark goal as achieved
          </Button>
        ) : (
          <Button variant="secondary" className="w-full justify-start" onClick={() => setStatus("active")}>
            <RotateCcw /> Reactivate goal
          </Button>
        )}
        {goal.status !== "archived" ? (
          <Button variant="secondary" className="w-full justify-start" onClick={() => setStatus("archived")}>
            <Archive /> Archive (hide from Today)
          </Button>
        ) : (
          <Button variant="secondary" className="w-full justify-start" onClick={() => setStatus("active")}>
            <RotateCcw /> Unarchive
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" className="w-full justify-start">
              <Trash2 /> Delete goal
            </Button>
          </DialogTrigger>
          <DialogContent title="Delete this goal?" description="This permanently deletes the goal, its research, roadmap, tasks, reviews and coach history.">
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    await deleteGoalAction(goal.id);
                    toast.success("Goal deleted");
                    router.push("/dashboard");
                  })
                }
              >
                Delete permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
