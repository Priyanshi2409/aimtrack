import { Bot, Database, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/app/settings-form";
import { PageHeader } from "@/components/app/widgets";
import { Badge, Card } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { env, isAiLive, isSupabaseAuth } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { profile, usage } = await withUser(user.id, async (tx) => ({
    profile: await repo.getProfile(tx, user.id),
    usage: await tx`select kind, count(*)::int as n from ai_calls where created_at > now() - interval '24 hours' group by kind`,
  }));
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm name={profile.display_name ?? ""} timezone={profile.timezone} email={user.email} isDemo={profile.is_demo} />
      <Card className="mt-6 grid gap-4 p-5 text-sm sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 size-4 text-iris" />
          <div>
            <div className="font-medium">AI</div>
            {isAiLive() ? (
              <div className="text-muted">
                Claude · research/planning <span className="font-mono text-xs">{env.aiModelSmart}</span>, coach/reviews <span className="font-mono text-xs">{env.aiModelFast}</span>
              </div>
            ) : (
              <Badge tone="iris">Offline templates</Badge>
            )}
            <div className="mt-1 text-xs text-subtle">AI calls in the last 24h: {usage.reduce((s, r) => s + (r.n as number), 0)}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 text-volt-strong" />
          <div>
            <div className="font-medium">Auth</div>
            <div className="text-muted">{isSupabaseAuth() ? "Supabase Auth" : "Local dev auth"}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 size-4 text-sky" />
          <div>
            <div className="font-medium">Data</div>
            <div className="text-muted">Postgres with row-level security. Only you can read your rows.</div>
          </div>
        </div>
      </Card>
    </>
  );
}
