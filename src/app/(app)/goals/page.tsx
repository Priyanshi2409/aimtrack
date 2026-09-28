import { Plus, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoadSamplesButton } from "@/components/app/small-actions";
import { GoalCard, PageHeader, SectionTitle } from "@/components/app/widgets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import { loadInsights } from "@/lib/services/insights";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const { goalStats } = await withUser(user.id, (tx) => loadInsights(tx, user.id));
  const all = await withUser(user.id, async (tx) => (await import("@/lib/db/repo")).listGoals(tx, { includeArchived: true }));
  const archived = all.filter((g) => g.status === "archived");
  return (
    <>
      <PageHeader
        title="Goals"
        action={
          <Button asChild>
            <Link href="/goals/new">
              <Plus /> New goal
            </Link>
          </Button>
        }
      />
      {goalStats.length === 0 && archived.length === 0 ? (
        <EmptyState icon={<Target />} title="No goals yet" body="Start with one goal you actually care about." action={<LoadSamplesButton />} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goalStats.map((s) => (
            <GoalCard key={s.goal.id} goal={s.goal} phaseTitle={s.currentPhase?.title} milestonesDone={s.milestonesDone} milestonesTotal={s.milestonesTotal} timeElapsedPct={s.timeElapsedPct} weekRate={s.weekRate} minutes={s.minutes} />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <section className="mt-10">
          <SectionTitle>Archived</SectionTitle>
          <ul className="space-y-1">
            {archived.map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}/settings`} className="text-sm text-muted hover:text-fg">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
