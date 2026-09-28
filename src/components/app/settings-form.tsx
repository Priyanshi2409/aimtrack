"use client";

import { Download, LogOut, Moon, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signOut } from "@/app/actions/auth";
import { deleteAllDataAction, updateProfileAction } from "@/app/actions/tracking";
import { LoadSamplesButton } from "@/components/app/small-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Card, Input, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const ZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export function SettingsForm({ name, timezone, email, isDemo }: { name: string; timezone: string; email: string; isDemo: boolean }) {
  const [displayName, setDisplayName] = useState(name);
  const [tz, setTz] = useState(timezone);
  const [pending, start] = useTransition();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-5 p-5">
        <h2 className="font-semibold">Profile</h2>
        <div className="space-y-2">
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm">
            {[...new Set([timezone, ...ZONES])].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <p className="text-xs text-subtle">Used for &quot;today&quot;, streaks and when reviews are written.</p>
        </div>
        <div className="text-xs text-subtle">Signed in as {email}</div>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              await updateProfileAction({ display_name: displayName.trim() || undefined, timezone: tz });
              toast.success("Profile saved");
            })
          }
        >
          Save profile
        </Button>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Appearance</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "dark", label: "Dark", icon: Moon },
              { v: "light", label: "Light", icon: Sun },
            ].map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setTheme(v)}
                aria-pressed={resolvedTheme === v}
                className={cn("flex items-center justify-center gap-2 rounded-xl border py-3 text-sm", resolvedTheme === v ? "border-volt-strong bg-volt-soft" : "border-border")}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Data</h2>
          <div className="flex flex-wrap gap-2">
            <LoadSamplesButton variant="outline" />
            <Button variant="outline" asChild>
              <a href="/api/export">
                <Download /> Export my data (JSON)
              </a>
            </Button>
          </div>
          {!isDemo && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="danger">
                  <Trash2 /> Delete all my data
                </Button>
              </DialogTrigger>
              <DialogContent title="Delete everything?" description="All goals, tasks, check-ins, reviews and coach chats are permanently removed. Your login stays.">
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="danger"
                    onClick={() =>
                      start(async () => {
                        await deleteAllDataAction();
                        toast.success("All data deleted");
                      })
                    }
                  >
                    Delete everything
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </Card>

        <form action={signOut}>
          <Button variant="ghost" type="submit">
            <LogOut /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
