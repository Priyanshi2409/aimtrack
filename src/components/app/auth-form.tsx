"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { signIn, signInDemo, signUp, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);
  const [demoPending, startDemo] = useTransition();
  const [demoState, setDemoState] = useState<string | null>(null);

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1.5 text-sm text-muted">
        {mode === "login" ? "Pick up where you left off." : "Turn one goal into a plan you'll actually follow."}
      </p>

      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="given-name" placeholder="What should we call you?" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} placeholder="At least 8 characters" />
        </div>
        {(state?.error || demoState) && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {state?.error ?? demoState}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={pending}>
          {mode === "login" ? "Sign in" : "Create account"} <ArrowRight />
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        loading={demoPending}
        onClick={() =>
          startDemo(async () => {
            const r = await signInDemo();
            if (r?.error) setDemoState(r.error);
          })
        }
      >
        <Sparkles className="text-volt-strong" /> Explore the live demo account
      </Button>

      <p className="mt-8 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-fg underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-fg underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

