"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadSampleGoalsAction } from "@/app/actions/tracking";
import { Button } from "@/components/ui/button";

export function LoadSamplesButton({ variant = "secondary" }: { variant?: "secondary" | "primary" | "outline" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await loadSampleGoalsAction();
          toast.success(r.created ? "Added 3 sample goals with a few weeks of history" : "Sample goals are already in your account");
        })
      }
    >
      <Sparkles /> Load sample goals
    </Button>
  );
}

/**
 * Rolling horizon: when a goal has fewer than ~4 days of tasks left, quietly ask the
 * server to generate the next week (AI when configured). Runs once per mount.
 */
export function HorizonExtender({ goalIds }: { goalIds: string[] }) {
  const router = useRouter();
  const ran = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (ran.current || goalIds.length === 0) return;
    ran.current = true;
    setBusy(true);
    Promise.allSettled(goalIds.map((id) => fetch(`/api/goals/${id}/extend`, { method: "POST" }).then((r) => r.json())))
      .then((results) => {
        const added = results.reduce((s, r) => s + (r.status === "fulfilled" && r.value?.added ? r.value.added : 0), 0);
        if (added) {
          toast.success(`Planned your next week: ${added} new tasks`);
          router.refresh();
        }
      })
      .finally(() => setBusy(false));
  }, [goalIds, router]);
  if (!busy) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-iris/30 bg-iris-soft px-3 py-2 text-xs text-iris" role="status">
      <span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" /> Planning your next week of tasks…
    </div>
  );
}
