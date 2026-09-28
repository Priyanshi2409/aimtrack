import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { ResearchSection } from "@/components/app/research-cards";
import { Card } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import type { ResearchKind } from "@/lib/types";

export const metadata: Metadata = { title: "Research" };

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { runs, findings } = await withUser(user.id, (tx) => repo.getResearch(tx, id));
  const kinds: ResearchKind[] = ["examples", "requirements", "pitfalls"];
  let idx = 1;
  const totalSources = new Set(runs.flatMap((r) => r.searched_urls)).size;
  return (
    <div className="space-y-10">
      <Card className="flex items-start gap-3 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-volt-strong" />
        <p className="text-muted">
          <span className="font-medium text-fg">How this research was verified: </span>
          the agent read {totalSources} web page{totalSources === 1 ? "" : "s"}. A finding is kept only if its link is one of the pages the search tool actually returned.
          Anything that couldn&apos;t be traced to a real page was removed, and sections with no reliable sources are left empty on purpose.
        </p>
      </Card>
      {kinds.map((k) => {
        const f = findings.filter((x) => x.kind === k);
        const start = idx;
        idx += f.length;
        return <ResearchSection key={k} kind={k} findings={f} run={runs.find((r) => r.kind === k)} startIndex={start} />;
      })}
    </div>
  );
}
