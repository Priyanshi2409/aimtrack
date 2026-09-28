"use client";

import { Check, Flag } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleMilestone } from "@/app/actions/tracking";
import { burst } from "@/components/app/task-item";
import { formatDate } from "@/lib/core/dates";
import type { Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MilestoneCheck({ m, overdue }: { m: Milestone; overdue: boolean }) {
  const [done, setDone] = useOptimistic(Boolean(m.completed_at));
  const [, start] = useTransition();
  return (
    <div className="flex items-start gap-3 rounded-xl px-2 py-2">
      <button
        type="button"
        aria-pressed={done}
        aria-label={done ? `Mark milestone "${m.title}" as not reached` : `Mark milestone "${m.title}" as reached`}
        onClick={() =>
          start(async () => {
            setDone(!done);
            if (!done) burst();
            await toggleMilestone(m.id, !done);
          })
        }
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
          done ? "border-volt bg-volt text-volt-fg" : "border-border-strong text-subtle hover:border-volt-strong",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : <Flag className="size-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-medium", done && "text-subtle line-through")}>{m.title}</div>
        <div className="mt-0.5 text-xs text-subtle">{m.success_criteria}</div>
      </div>
      {m.target_date && (
        <span className={cn("shrink-0 font-mono text-xs", overdue && !done ? "text-ember" : "text-subtle")}>
          {formatDate(m.target_date, { day: "numeric", month: "short" })}
        </span>
      )}
    </div>
  );
}
