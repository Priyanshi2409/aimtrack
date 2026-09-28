import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { GenerateReviewButton, ReviewCard } from "@/components/app/reviews";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const reviews = await withUser(user.id, (tx) => repo.listReviews(tx, { goalId: id, kind: "weekly", limit: 12 }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">A weekly review is written automatically every Monday. You can also generate one any time.</p>
        <div className="flex gap-2">
          <GenerateReviewButton goalId={id} kind="weekly" period="current" label="This week so far" />
          <GenerateReviewButton goalId={id} kind="weekly" period="previous" label="Last week" />
        </div>
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={<ScrollText />} title="No reviews yet" body="Your first weekly review appears after your first full week, with completion rate, streak, what went well, what slipped and one focus." />
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} r={r} />)
      )}
    </div>
  );
}
