"use client";

import { motion } from "framer-motion";
import { BookOpen, MessageCircle, Route, Settings2, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { replanGoalAction } from "@/app/actions/tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GoalTabs({ id }: { id: string }) {
  const path = usePathname();
  const tabs = [
    { href: `/goals/${id}`, label: "Roadmap", icon: Route },
    { href: `/goals/${id}/research`, label: "Research", icon: BookOpen },
    { href: `/goals/${id}/coach`, label: "Coach", icon: MessageCircle },
    { href: `/goals/${id}/reviews`, label: "Reviews", icon: ScrollText },
    { href: `/goals/${id}/settings`, label: "Settings", icon: Settings2 },
  ];
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Goal sections">
      <div className="inline-flex min-w-full gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition", active ? "text-fg" : "text-muted hover:text-fg")}
            >
              <t.icon className="size-4" />
              {t.label}
              {active && <motion.span layoutId="goal-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-volt-strong" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function ReplanButton({ goalId }: { goalId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await replanGoalAction(goalId);
          toast(r.moved ? "Plan rebalanced" : "Nothing to rebalance", { description: r.summary, duration: 7000 });
          router.refresh();
        })
      }
    >
      Replan now
    </Button>
  );
}
