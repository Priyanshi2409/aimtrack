"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, RefreshCw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { dismissReplans } from "@/app/actions/tracking";
import { formatDate } from "@/lib/core/dates";
import type { ReplanEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEAD = { ahead: "Pulled work forward", manual: "Day lightened", behind: "Rebalanced" } as const;

/** One compact card that explains what the replanner changed and why, with every task move. */
export function ReplanNotices({ events, goalTitles }: { events: ReplanEvent[]; goalTitles: Record<string, string> }) {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [, start] = useTransition();
  if (!events.length) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="mb-5 overflow-hidden rounded-2xl border border-iris/30 bg-iris-soft">
          <div className="flex items-center gap-3 px-4 pt-3">
            <RefreshCw className="size-4 shrink-0 text-iris" />
            <div className="flex-1 text-sm font-semibold">Your plan adapted</div>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-lg p-1 text-muted hover:bg-surface/50 hover:text-fg"
              onClick={() => {
                setVisible(false);
                start(() => dismissReplans(events.map((e) => e.id)));
              }}
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="px-2 pb-2 pt-1">
            {events.map((e) => {
              const isOpen = open === e.id;
              const moved = e.changes.length;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-surface/40"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{goalTitles[e.goal_id] ?? HEAD[e.kind]}</span>
                      <span className="text-muted">
                        {" "}
                        · {HEAD[e.kind].toLowerCase()}, {moved} task{moved === 1 ? "" : "s"} moved
                      </span>
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-2 pb-3">
                          <p className="text-sm leading-relaxed text-muted">{e.summary}</p>
                          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                            {e.changes.map((c) => (
                              <li key={c.taskId + c.to} className="flex items-center gap-1.5 text-muted">
                                <span className="min-w-0 flex-1 truncate text-fg">{c.title}</span>
                                <span className="font-mono">{formatDate(c.from)}</span>
                                <ArrowRight className="size-3 shrink-0" />
                                <span className="font-mono text-fg">{formatDate(c.to)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
