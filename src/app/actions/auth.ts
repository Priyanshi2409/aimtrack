"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCAL_COOKIE, signSession } from "@/lib/auth/local";
import { supabaseServer } from "@/lib/auth/supabase";
import { db, withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { env, isSupabaseAuth } from "@/lib/env";

export type AuthState = { error?: string } | undefined;

const Creds = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  name: z.string().trim().max(60).optional(),
});

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

async function localSession(id: string, email: string) {
  (await cookies()).set(LOCAL_COOKIE, signSession(id, email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Creds.pick({ email: true, password: true }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  if (isSupabaseAuth()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: error?.message === "Email not confirmed" ? "Please confirm your email first." : "Wrong email or password." };
    await withUser(data.user.id, (tx) => repo.ensureProfile(tx, data.user.id));
  } else {
    const [u] = await db()`select id from auth.users where email = ${email} and encrypted_password = crypt(${password}, encrypted_password)`;
    if (!u) return { error: "Wrong email or password." };
    await localSession(u.id as string, email);
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password"), name: form.get("name") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, name } = parsed.data;

  let userId: string;
  if (isSupabaseAuth()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Sign-up failed. Please try again." };
    if (!data.session) return { error: "Check your inbox to confirm your email, then sign in." };
    userId = data.user.id;
  } else {
    const [exists] = await db()`select 1 from auth.users where email = ${email}`;
    if (exists) return { error: "An account with this email already exists." };
    const [u] = await db()`insert into auth.users (email, encrypted_password) values (${email}, crypt(${password}, gen_salt('bf'))) returning id`;
    userId = u.id as string;
    await localSession(userId, email);
  }
  await withUser(userId, (tx) => repo.ensureProfile(tx, userId, name ?? email.split("@")[0]));
  redirect("/dashboard?welcome=1");
}

/** One-click sign-in to the shared, pre-seeded demo account. */
export async function signInDemo(): Promise<AuthState> {
  if (isSupabaseAuth()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email: env.demoEmail, password: env.demoPassword });
    if (error) return { error: "The demo account isn't ready yet. Please sign up instead." };
  } else {
    const [u] = await db()`select id from auth.users where email = ${env.demoEmail}`;
    if (!u) return { error: "Demo data hasn't been seeded. Run npm run seed." };
    await localSession(u.id as string, env.demoEmail);
  }
  redirect("/dashboard");
}

export async function signOut() {
  if (isSupabaseAuth()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(LOCAL_COOKIE);
  redirect("/");
}
