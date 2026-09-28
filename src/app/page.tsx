import { ArrowRight, Bot, CalendarCheck, Check, ExternalLink, Flame, Gauge, Globe, RefreshCw, ScrollText, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInDemo } from "@/app/actions/auth";
import { Hero3D } from "@/components/app/landing-motion";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";

async function demo() {
  "use server";
  const r = await signInDemo();
  if (r?.error) redirect("/login?demo=unavailable");
}

const STEPS = [
  { icon: Sparkles, title: "Say it plainly", body: "“Run a half marathon by March.” AimTrack asks 2–3 sharp questions: your level, budget, constraints." },
  { icon: Search, title: "Research agents go out", body: "Three agents search the web in parallel for real people who did it, what it takes, and where people fail." },
  { icon: Gauge, title: "Honest reality check", body: "A feasibility score with reasons. If your deadline is unrealistic, it says so and suggests a better one." },
  { icon: CalendarCheck, title: "A plan that adapts", body: "Phases, milestones, weekly targets and daily tasks sized to your time. Miss a day and it rebalances." },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Every claim is cited", body: "A finding is kept only if its link is a page the search tool actually returned. Otherwise it's dropped, never invented." },
  { icon: RefreshCw, title: "Replanning that respects you", body: "Missed tasks spread into slack days in the original order, never above your daily limit, and it tells you exactly what moved." },
  { icon: Bot, title: "A coach that knows your data", body: "“I only have an hour today.” The coach sees your roadmap, completion rate and check-ins, and picks the highest-leverage task." },
  { icon: ScrollText, title: "Weekly reviews", body: "Completion rate, streak, what went well, what slipped, and one concrete focus for next week. Written from your real numbers." },
  { icon: Flame, title: "Streaks & consistency", body: "A GitHub-style heatmap, streaks, planned-vs-actual time and milestone progress, all in one place." },
  { icon: CalendarCheck, title: "30-second check-ins", body: "Energy, mood, one line on what blocked you. Low energy for 3 days? Tomorrow gets lighter automatically." },
];

export default async function Landing() {
  const user = await getUser();
  return (
    <div className="relative overflow-x-hidden">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[900px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-volt/10 blur-[120px]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                Open app <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted backdrop-blur">
              <span className="size-1.5 rounded-full bg-volt" /> AI goal system with cited research
            </div>
            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              Goals, grounded in how people <span className="relative whitespace-nowrap text-volt-strong">actually did it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Write any goal. AimTrack researches real paths, gives you an honest reality check, builds a day-by-day plan around your time, and adapts every day based on
              what you actually do.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={user ? "/goals/new" : "/signup"}>
                  Start your first goal <ArrowRight />
                </Link>
              </Button>
              {!user && (
                <form action={demo}>
                  <Button type="submit" variant="secondary" size="lg">
                    <Sparkles className="text-volt-strong" /> Explore the live demo
                  </Button>
                </form>
              )}
            </div>
            <p className="mt-4 text-xs text-subtle">Free. No card. Demo account comes preloaded with 3 goals and weeks of history.</p>
          </div>
          <Hero3D />
        </section>

        <section className="border-y border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">From one sentence to a plan you follow</h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div key={s.title}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-volt-soft text-volt-strong">
                      <s.icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-subtle">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-surface p-6 shadow-card">
                <f.icon className="size-5 text-volt-strong" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-12">
            <div className="absolute -right-24 -top-24 size-72 rounded-full bg-iris/15 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">No fake people. No made-up statistics.</h2>
                <p className="mt-4 leading-relaxed text-muted">
                  Most AI planners confidently invent success stories. AimTrack&apos;s research agent can only cite pages its web search actually returned. Every other claim is
                  removed before you see it. If nothing reliable exists, you get an honest &quot;no reliable source found&quot;.
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  ["Search", "2–4 focused web searches per research area"],
                  ["Extract", "Findings returned as strict JSON, validated with Zod"],
                  ["Verify", "Every source URL checked against the search results"],
                  ["Drop", "Unverifiable claims removed and counted, not hidden"],
                ].map(([a, b]) => (
                  <li key={a} className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                    <Check className="mt-0.5 size-4 text-volt-strong" />
                    <span>
                      <span className="font-medium">{a}: </span>
                      <span className="text-muted">{b}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-28 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">What do you want to achieve?</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={user ? "/goals/new" : "/signup"}>
                Start now <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-subtle">
          <Logo className="scale-90" />
          <span className="flex items-center gap-1.5">
            <Globe className="size-3.5" /> Built with Next.js, Supabase and Claude
          </span>
          <a href="/api/health" className="inline-flex items-center gap-1 hover:text-fg">
            Status <ExternalLink className="size-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
