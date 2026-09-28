# AimTrack: one-page project summary

**One line:** An AI goal-achievement system. You type a goal, it researches how real people achieved it (with verified citations), checks feasibility honestly, builds a day-by-day plan around your available time, tracks you daily, and adapts the plan when life happens.

## The problem
Goal apps are either dumb checklists or AI planners that confidently invent "success stories" and unrealistic schedules. People abandon plans that don't fit their real time and don't adapt when they miss a day.

## What I built (features)
1. **Goal wizard**: plain-language goal → AI clarifying questions (level, budget, constraints) → deadline + minutes/day.
2. **Research agents**: 3 agents search the web in parallel (real examples, requirements/costs, failure points). The UI streams what each agent is doing live.
3. **Anti-hallucination by design**: a finding is kept only if its URL was actually returned by the search tool; otherwise it's dropped and counted. No source → "No reliable source found".
4. **Reality check**: feasibility score, verdict, reasons, and a suggested deadline you can accept.
5. **Roadmap**: Goal → Phases → Milestones → Weekly targets → Daily tasks (time, difficulty, why it matters, resource).
6. **Daily tracking**: tick tasks, log time, 30-second check-in (energy, mood, blocker), "Lighten today", pull work forward when ahead.
7. **Adaptive replanning**: missed tasks move into slack days in order, never over your daily limit, lighter on low-energy days, and every change is explained.
8. **AI coach** per goal that sees your plan, progress and check-ins. **Weekly reviews + monthly report**. **Data-driven nudges**.
9. **Analytics**: GitHub-style heatmap, streaks, weekly completion vs *original* plan, planned vs actual time, milestones.
10. **PWA**: installable, dark/light, mobile-first, accessible (keyboard, contrast, data tables for charts).

## Tech stack
Next.js 16 (App Router, Server Actions, streaming route handlers) · TypeScript · Tailwind v4 · Radix/shadcn-style UI · Framer Motion · Recharts · Supabase (Postgres + Auth + RLS) · Claude API with web search · Zod · Vitest · Playwright · GitHub Actions → Vercel.

## Engineering highlights (good interview talking points)
- **Structured AI output contract**: the plan is strict JSON validated by Zod. On failure the model gets the exact validation errors and one retry, then the user sees a friendly error. Post-validation also fixes what Zod can't: URL provenance, index bounds, daily capacity.
- **Real Row Level Security**: every request runs as the Postgres `authenticated` role with the user's JWT claims, so RLS is enforced even if a query is wrong. Tested locally against a Supabase-compatible shim.
- **Deterministic core**: replanning, streaks, stats and nudges are pure functions with 41 unit tests (e.g. "replans can't hide misses", timezone-correct streaks, capacity never exceeded).
- **Honest metrics**: completion is measured against the original plan, so moving a task doesn't erase the miss.
- **Cost & abuse control**: per-user daily AI budgets, a global cap, research cached per goal, cheaper model for chatty features. Roughly $0.25 per new goal.
- **Resilience**: retries with backoff, typed error mapping, streamed progress with heartbeats to survive long calls, per-step retry buttons, offline template mode.
- **Fully automated delivery**: CI (lint, types, unit, E2E on a throwaway Postgres) → migrate → seed → configure Vercel via REST → deploy → Playwright smoke test on production. A nightly cron handles replans, reviews and demo reset.

## Product decisions I can defend
- Reality check *before* planning (cheaper, and the user decides the deadline).
- "Ahead of plan" is a one-tap suggestion, not a silent change.
- 14 days planned up front, then weekly extensions that adapt to actual performance.
- The coach explains and recommends. Plan changes stay deterministic and explainable.

## If I had more time
Calendar sync (Google Calendar), push notifications for nudges, collaborative goals (accountability partner), RAG over the user's own notes, an evaluation harness for plan quality (LLM-as-judge + human rubric), and A/B testing nudge wording against completion rate.
