# Decisions I made

Short log of choices made while building autonomously, with the reason for each.

| # | Decision | Why |
|---|---|---|
| 1 | **Claude (Anthropic) as the AI provider**, behind an `AIProvider` interface | The spec asked for tool use + web search. Claude's server-side `web_search` tool returns the exact URLs it read, which makes citation verification possible. Gemini's free tier no longer includes Google Search grounding, so there was no free option with real search. |
| 2 | Two model tiers: `claude-sonnet-5` (research/plan), `claude-haiku-4-5` (questions, coach, reviews, weekly extension) | Quality where it matters, ~2× cheaper for chatty/simple calls. Both configurable via env. |
| 3 | **Citation verification in code**, not just in the prompt | Prompts can't guarantee honesty. Findings whose URL wasn't returned by the search tool are dropped and counted. |
| 4 | Research split into **3 parallel agents** streamed as NDJSON | Faster (parallel), keeps each call well under the 300s Vercel Hobby limit, and gives a truthful live progress UI (actual queries and domains, not fake spinners). |
| 5 | Reality check is a **separate step** before planning | You can accept a suggested deadline before the (more expensive) plan is generated. The plan still returns its own `feasibility` per the contract. |
| 6 | **Deterministic replanning engine**, AI not involved | Replanning must be predictable, instant, free and testable. It preserves task order, uses slack first, never exceeds daily capacity, and trims low-energy days. |
| 7 | "Ahead" = **one-tap pull-forward suggestion** instead of silently moving work | Auto-pulling tasks while you're still working felt intrusive. The engine computes the pull; you confirm. |
| 8 | **Rolling horizon**: 14 days up front, then +7 days when <4 remain | The contract asks for 2 weeks of daily tasks. Generating later weeks from actual performance keeps the plan realistic. |
| 9 | Completion rate measured against the **original** plan (`original_date`), skipped tasks count as not done | Otherwise replanning would hide misses and the metric would lie. |
| 10 | Direct Postgres (`postgres.js`) + **`set local role authenticated`** per request instead of supabase-js queries | Gives real RLS enforcement, plain SQL, and lets CI run the exact same code against a local Postgres. |
| 11 | Hardening migration: users can't edit `ai_calls` or `profiles.is_demo`; `anon` has no table access | Supabase also exposes tables over REST with the user's JWT, so limits must hold there too. |
| 12 | **Email + password auth**, "Confirm email" off | Fewest human setup steps and no SMTP dependency. Can be switched on in Supabase any time. |
| 13 | **Shared demo account**, reseeded nightly by cron | Every screen looks alive on first visit and dates stay relative to today. Tighter AI budgets for the demo protect cost. |
| 14 | "Load sample goals" button for real accounts instead of auto-seeding | Don't mix fake data into a user's real goals without asking. |
| 15 | Sample research uses **real sources I verified** (Internshala, Mind the Product, Hal Higdon, Wikipedia, YourStory, Restaurant India, Tally) | The "no fake people" rule applies to demo data too. |
| 16 | Offline mode (no AI key) uses **labelled templates** and does *no* research | The app is testable end to end without paid calls, and it never fabricates. |
| 17 | Per-user daily AI budgets + global `AI_DAILY_CALL_CAP` | A public signup page connected to a paid API needs a cost ceiling. |
| 18 | Deploy via **GitHub Actions → Vercel CLI/REST** instead of Vercel's Git integration | Fully scripted: creates the project, sets env vars, migrates, seeds, deploys and smoke-tests with no dashboard clicks. |
| 19 | `regions: ["bom1"]` (Mumbai) | Same region as the Supabase project → low DB latency for Indian users. |
| 20 | Hand-written shadcn-style components (Radix primitives) | The shadcn registry wasn't reachable from the build sandbox. Same API and styling approach. |
| 21 | Geist fonts from the `geist` npm package | Self-hosted, no build-time font download. |
| 22 | Design: near-black + "volt" lime accent, dark by default | High-energy, "training app" feel that fits goal tracking. Every categorical color also has a text label (charts avoid color-only identity). |
| 23 | Coach can't modify the plan directly; it points you to "Lighten today" / "Replan" | Keeps plan changes deterministic and explainable. |
| 24 | Timezone per user (default Asia/Kolkata), dates stored as `DATE` strings | Streaks and "today" must follow the user's day, not the server's UTC day. |
