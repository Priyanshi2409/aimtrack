import { AlertTriangle, BookOpen, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import type { ResearchFinding, ResearchKind, ResearchRun } from "@/lib/types";
import { cn, hostOf } from "@/lib/utils";

export const KIND_META: Record<ResearchKind, { label: string; blurb: string; icon: typeof Users; tone: string }> = {
  examples: { label: "Real-life examples", blurb: "People who achieved this or something close, and the path they took", icon: Users, tone: "text-volt-strong bg-volt-soft" },
  requirements: { label: "What it takes", blurb: "Skills, resources, costs and typical timelines", icon: BookOpen, tone: "text-sky bg-sky-soft" },
  pitfalls: { label: "Where people fail", blurb: "Common failure points and how others got past them", icon: AlertTriangle, tone: "text-ember bg-ember-soft" },
};

function DetailValue({ v }: { v: unknown }) {
  if (Array.isArray(v))
    return (
      <ul className="mt-1 space-y-0.5">
        {v.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-subtle">–</span>
            {String(x)}
          </li>
        ))}
      </ul>
    );
  return <>{String(v)}</>;
}

const LABELS: Record<string, string> = { who: "Who", timeline: "Timeline", key_steps: "Key steps", fix: "How people got past it", cost: "Cost", time: "Time", type: "Type" };

export function FindingCard({ f, index }: { f: Pick<ResearchFinding, "title" | "summary" | "detail" | "source_url" | "source_title" | "kind">; index?: number }) {
  const details = Object.entries(f.detail ?? {}).filter(([k, v]) => k !== "type" && v !== "" && v != null);
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start gap-2">
        {index != null && <span className="tabular mt-0.5 font-mono text-xs text-subtle">[{index}]</span>}
        <h4 className="text-sm font-semibold leading-snug">{f.title}</h4>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{f.summary}</p>
      {details.length > 0 && (
        <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="font-medium text-subtle">{LABELS[k] ?? k.replace(/_/g, " ")}</dt>
              <dd className="text-fg">
                <DetailValue v={v} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <a
        href={f.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-xs font-medium text-sky hover:underline"
        title={f.source_url}
      >
        <ExternalLink className="size-3" />
        {f.source_title ? `${f.source_title} · ` : ""}
        {hostOf(f.source_url)}
      </a>
    </Card>
  );
}

export function ResearchSection({ kind, findings, run, startIndex = 1 }: { kind: ResearchKind; findings: ResearchFinding[]; run?: ResearchRun; startIndex?: number }) {
  const meta = KIND_META[kind];
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={cn("grid size-8 place-items-center rounded-lg", meta.tone)}>
          <meta.icon className="size-4" />
        </span>
        <div>
          <h3 className="font-semibold">{meta.label}</h3>
          <p className="text-xs text-subtle">{meta.blurb}</p>
        </div>
        {run && (
          <Badge tone="volt" className="ml-auto">
            <ShieldCheck className="size-3" /> {findings.length} verified of {run.searched_urls.length} sources read
            {run.dropped_count > 0 && ` · ${run.dropped_count} removed`}
          </Badge>
        )}
      </div>
      {findings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-5 text-sm text-muted">
          <span className="font-medium text-fg">No reliable source found. </span>
          {run?.note ?? "The research agent couldn't find sources it could verify, so it left this empty instead of guessing."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {findings.map((f, i) => (
            <FindingCard key={f.id} f={f} index={startIndex + i} />
          ))}
        </div>
      )}
    </section>
  );
}
