import { MobileHeader, MobileNav, Sidebar } from "@/components/app/nav";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { profile, goals } = await withUser(user.id, async (tx) => ({
    profile: await repo.ensureProfile(tx, user.id, user.email.split("@")[0]),
    goals: await repo.listGoals(tx),
  }));
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        goals={goals.map((g) => ({ id: g.id, title: g.title, color: g.color, status: g.status }))}
        name={profile.display_name || user.email}
        isDemo={profile.is_demo}
      />
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
