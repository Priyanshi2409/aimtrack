"use client";

import { motion } from "framer-motion";
import { Battery, BatteryFull, BatteryLow, BatteryMedium, Check, Frown, Laugh, Meh, Smile, SmilePlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCheckin } from "@/app/actions/tracking";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import type { Checkin } from "@/lib/types";
import { cn } from "@/lib/utils";

const ENERGY = [
  { v: 1, label: "Drained", icon: Battery },
  { v: 2, label: "Low", icon: BatteryLow },
  { v: 3, label: "Okay", icon: BatteryMedium },
  { v: 4, label: "Good", icon: BatteryMedium },
  { v: 5, label: "Charged", icon: BatteryFull },
];
const MOOD = [
  { v: 1, label: "Rough", icon: Frown },
  { v: 2, label: "Meh", icon: Meh },
  { v: 3, label: "Fine", icon: Smile },
  { v: 4, label: "Good", icon: SmilePlus },
  { v: 5, label: "Great", icon: Laugh },
];

function Scale({ name, options, value, onChange }: { name: string; options: typeof ENERGY; value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-1.5">
      {options.map(({ v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition",
              active ? "border-volt-strong bg-volt-soft text-fg" : "border-border text-subtle hover:border-border-strong hover:text-fg",
            )}
          >
            <Icon className={cn("size-4", active && "text-volt-strong")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function CheckinCard({ existing }: { existing: Checkin | null }) {
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [blocker, setBlocker] = useState(existing?.blocker ?? "");
  const [editing, setEditing] = useState(!existing);
  const [pending, start] = useTransition();

  if (!editing && existing) {
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-volt-soft text-volt-strong">
            <Check className="size-4" />
          </span>
          <div>
            <div className="text-sm font-medium">Checked in today</div>
            <div className="text-xs text-subtle">
              Energy {existing.energy}/5 · Mood {existing.mood}/5{existing.blocker ? ` · "${existing.blocker}"` : ""}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">30-second check-in</h2>
        <span className="text-xs text-subtle">shapes tomorrow&apos;s load</span>
      </div>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!energy || !mood) return toast.error("Pick your energy and mood first.");
          start(async () => {
            await saveCheckin({ energy, mood, blocker: blocker.trim() || null });
            toast.success(energy <= 2 ? "Noted. I'll go easier on you tomorrow." : "Check-in saved");
            setEditing(false);
          });
        }}
      >
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">Energy</div>
          <Scale name="Energy" options={ENERGY} value={energy} onChange={setEnergy} />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">Mood</div>
          <Scale name="Mood" options={MOOD} value={mood} onChange={setMood} />
        </div>
        <div className="space-y-2">
          <label htmlFor="blocker" className="text-xs font-medium text-muted">
            What blocked you? <span className="text-subtle">(optional)</span>
          </label>
          <input
            id="blocker"
            value={blocker}
            maxLength={280}
            onChange={(e) => setBlocker(e.target.value)}
            placeholder="e.g. assignment deadline, slept late"
            className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm placeholder:text-subtle focus:border-volt-strong focus:outline-none"
          />
        </div>
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button type="submit" className="w-full" loading={pending} disabled={!energy || !mood}>
            Save check-in
          </Button>
        </motion.div>
      </form>
    </Card>
  );
}
