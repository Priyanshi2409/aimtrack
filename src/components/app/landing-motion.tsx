"use client";

import { motion } from "framer-motion";
import { Check, ExternalLink, Flame, ShieldCheck } from "lucide-react";

const fade = (d: number) => ({ initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } });

/** Layered product preview on the landing page (static content, illustrative UI). */
export function Hero3D() {
  return (
    <div className="relative mx-auto h-[500px] w-full max-w-[520px]" aria-hidden>
      {/* Research card */}
      <motion.div {...fade(0.1)} className="absolute left-0 top-0 w-[78%] rounded-2xl border border-border bg-surface p-4 shadow-2xl">
        <div className="flex items-center gap-2 text-[11px] font-medium text-volt-strong">
          <ShieldCheck className="size-3.5" /> Verified finding
        </div>
        <div className="mt-2 text-sm font-semibold">Chai Sutta Bar: started in Indore on about ₹3 lakh</div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">First outlet opened in 2016 near a girls&apos; hostel, serving tea in kulhads. Grew to ~380 outlets.</p>
        <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-sky">
          <ExternalLink className="size-3" /> en.wikipedia.org
        </div>
      </motion.div>

      {/* Reality check */}
      <motion.div {...fade(0.25)} className="absolute right-0 top-[104px] w-[44%] rounded-2xl border border-border bg-surface p-4 shadow-2xl">
        <div className="text-[11px] text-subtle">Reality check</div>
        <svg viewBox="0 0 180 100" className="mt-1 w-full">
          <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
          <motion.path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="var(--sky)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="220"
            initial={{ strokeDashoffset: 220 }}
            animate={{ strokeDashoffset: 220 - 0.62 * 220 }}
            transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
          />
          <text x="90" y="84" textAnchor="middle" className="fill-fg font-mono text-[30px] font-semibold">
            62
          </text>
        </svg>
        <div className="mt-1 text-center text-xs font-medium text-sky">Ambitious but doable</div>
      </motion.div>

      {/* Today card */}
      <motion.div {...fade(0.4)} className="absolute bottom-0 left-[8%] w-[84%] rounded-2xl border border-border bg-surface p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Today</div>
          <div className="flex items-center gap-1 rounded-full bg-ember-soft px-2 py-0.5 text-xs font-semibold text-ember">
            <Flame className="size-3.5 fill-ember" /> 12
          </div>
        </div>
        {[
          ["Write a 1-page teardown of Swiggy's reorder flow", "60m", true],
          ["Send 3 personalised LinkedIn notes to PMs", "25m", true],
          ["Easy run: 3 km at conversational pace", "30m", false],
        ].map(([t, m, d], i) => (
          <motion.div key={String(t)} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.12 }} className="mt-3 flex items-center gap-3">
            <span className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${d ? "border-volt bg-volt text-volt-fg" : "border-border-strong"}`}>{d && <Check className="size-3" strokeWidth={3.5} />}</span>
            <span className={`flex-1 truncate text-xs ${d ? "text-subtle line-through" : ""}`}>{t}</span>
            <span className="font-mono text-[11px] text-subtle">{m}</span>
          </motion.div>
        ))}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full rounded-full bg-volt" initial={{ width: 0 }} animate={{ width: "66%" }} transition={{ delay: 1.1, duration: 0.8 }} />
        </div>
      </motion.div>
    </div>
  );
}
