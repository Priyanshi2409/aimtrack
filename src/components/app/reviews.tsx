"use client";

import { CheckCircle2, Crosshair, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Ring } from "@/components/ui/primitives";
import { formatDate, formatMinutes } from "@/lib/core/dates";
import type { Review } from "@/lib/types";

export function ReviewCard({ r, goalTitle }: { r: Review; goalTitle?: string }) {
  const pct = Math.round((r.stats.completion_rate ?? 0) * 100);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.kind === "monthly" ? "iris" : "sky"}>{r.kind === "monthly" ? "Monthly report" : "Weekly review"}</Badge>
            {!r.ai_generated && <Badge>Rule-based</Badge>}
            {goalTitle && <span className="text-xs text-subtle">{goalTitle}</span>}
          </div>
          <h3 className="mt-2 font-semibold">
            {formatDate(r.period_start, { day: "numeric", month: "short" })} – {formatDate(r.period_end, { day: "numeric", month: "short", year: "numeric" })}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-subtle">
            <div>
              <span className="font-mono text-fg">{r.stats.done}</span>/{r.stats.planned} tasks
            </div>
            <div>{formatMinutes(r.stats.minutes ?? 0)} logged</div>
            {r.stats.streak ? <div>{r.stats.streak}-day streak</div> : null}
          </div>
          <Ring value={pct} size={56}>
            <span className="font-mono text-xs font-semibold">{pct}%</span>
          </Ring>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed">{r.content.summary}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {r.content.went_well?.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Went well</div>
            <ul className="space-y-1.5 text-sm">
              {r.content.went_well.map((w) => (
                <li key={w} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-volt-strong" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.content.slipped?.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Slipped</div>
            <ul className="space-y-1.5 text-sm">
              {r.content.slipped.map((w) => (
                <li key={w} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ember" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-volt-soft px-3 py-2.5 text-sm">
        <Crosshair className="mt-0.5 size-4 shrink-0 text-volt-strong" />
        <span>
          <span className="font-semibold">Focus next: </span>
          {r.content.focus}
        </span>
      </div>
    </Card>
  );
}

export function GenerateReviewButton({ goalId, kind, period, label }: { goalId: string | null; kind: "weekly" | "monthly"; period: "current" | "previous"; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goalId, kind, period }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) return void toast.error(d.error ?? "Couldn't generate the review");
          toast.success("Review ready");
          router.refresh();
        })
      }
    >
      <RefreshCw /> {label}
    </Button>
  );
}
