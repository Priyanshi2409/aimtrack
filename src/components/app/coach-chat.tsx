"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, Eraser } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { clearCoachAction } from "@/app/actions/tracking";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import type { CoachMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROMPTS = ["I only have 1 hour today. What should I do?", "I'm stuck on this phase. Help me get unstuck.", "Why am I falling behind?", "What's the most important thing this week?"];

/** Minimal, safe markdown: **bold**, bullet lists, paragraphs. No HTML injection. */
function Md({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={key + i}>{part.slice(2, -2)}</strong> : <span key={key + i}>{part}</span>));
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={bi} className="my-1.5 list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <span key={li}>
                {inline(l, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export function CoachChat({ goalId, initial, live }: { goalId: string; initial: CoachMessage[]; live: boolean }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; id: string }[]>(initial.map((m) => ({ role: m.role, content: m.content, id: m.id })));
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming) return;
    setInput("");
    const aid = crypto.randomUUID();
    setMessages((m) => [...m, { role: "user", content: msg, id: crypto.randomUUID() }, { role: "assistant", content: "", id: aid }]);
    setStreaming(true);
    try {
      const res = await fetch(`/api/coach/${goalId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "The coach couldn't reply. Please try again.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === aid ? { ...x, content: x.content + chunk } : x)));
      }
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== aid));
      toast.error((e as Error).message);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Card className="flex h-[calc(100dvh-20rem)] min-h-[440px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-iris-soft text-iris">
            <Bot className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">AimTrack Coach</div>
            <div className="text-[11px] text-subtle">{live ? "Knows your plan, progress and check-ins" : "Offline mode (rule-based replies)"}</div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              start(async () => {
                await clearCoachAction(goalId);
                setMessages([]);
              })
            }
          >
            <Eraser /> Clear
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-iris-soft text-iris">
              <Bot className="size-5" />
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted">Ask anything about this goal. The coach can see your roadmap, today&apos;s tasks, your completion rate and recent check-ins.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user" ? "rounded-br-md bg-volt text-volt-fg" : "rounded-bl-md border border-border bg-surface-2",
                )}
              >
                {m.content ? (
                  m.role === "assistant" ? <Md text={m.content} /> : m.content
                ) : (
                  <span className="inline-flex gap-1" aria-label="Coach is typing">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="size-1.5 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
                    ))}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        {messages.length === 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {PROMPTS.map((p) => (
              <button key={p} type="button" onClick={() => send(p)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-border-strong hover:text-fg">
                {p}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask your coach…"
            aria-label="Message the coach"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-sm placeholder:text-subtle focus:border-volt-strong focus:outline-none"
          />
          <Button type="submit" size="icon" className="size-11" disabled={!input.trim() || streaming} aria-label="Send">
            <ArrowUp />
          </Button>
        </form>
      </div>
    </Card>
  );
}
