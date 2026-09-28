"use client";

import { motion } from "framer-motion";
import { BarChart3, CalendarCheck, LayoutGrid, LogOut, Plus, Settings, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { cn, goalColor } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ goals, name, isDemo }: { goals: { id: string; title: string; color: string; status: string }[]; name: string; isDemo: boolean }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 backdrop-blur lg:flex">
      <Link href="/dashboard" className="px-3" aria-label="AimTrack dashboard">
        <Logo />
      </Link>

      <Link
        href="/goals/new"
        className="mx-1 mt-6 flex items-center justify-center gap-2 rounded-xl bg-volt px-3 py-2.5 text-sm font-semibold text-volt-fg transition hover:brightness-105"
      >
        <Plus className="size-4" /> New goal
      </Link>

      <nav className="mt-6 space-y-0.5" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
              <Icon className="relative size-4" />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Goals</div>
      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
        {goals.length === 0 && <p className="px-3 text-xs text-subtle">No goals yet</p>}
        {goals.map((g) => {
          const active = path.startsWith(`/goals/${g.id}`);
          return (
            <Link
              key={g.id}
              href={`/goals/${g.id}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition",
                active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-full", goalColor(g.color).dot, g.status !== "active" && "opacity-40")} />
              <span className="truncate">{g.title}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          {isDemo && <div className="text-[11px] text-volt-strong">Demo account</div>}
        </div>
        <div className="flex items-center">
          <ThemeToggle />
          <form action={signOut}>
            <button className="rounded-lg p-2 text-muted hover:bg-surface-3 hover:text-fg" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

const MOBILE = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/goals/new", label: "New", icon: Plus, cta: true },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {MOBILE.map(({ href, label, icon: Icon, cta }) => {
          const active = path === href || (href !== "/goals/new" && path.startsWith(href + "/"));
          return cta ? (
            <Link key={href} href={href} className="grid place-items-center py-2" aria-label="New goal">
              <span className="grid size-11 place-items-center rounded-2xl bg-volt text-volt-fg shadow-[0_8px_24px_-8px_var(--volt)]">
                <Icon className="size-5" />
              </span>
            </Link>
          ) : (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-fg" : "text-subtle")}
            >
              <Icon className={cn("size-5", active && "text-volt-strong")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
      <Link href="/dashboard" aria-label="Dashboard">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/goals" className="rounded-lg p-2 text-muted hover:text-fg" aria-label="All goals">
          <Target className="size-5" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
