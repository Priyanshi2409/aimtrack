import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseAuth } from "@/lib/env";
import { LOCAL_COOKIE, verifySession } from "./local";
import { supabaseServer } from "./supabase";

export interface SessionUser {
  id: string;
  email: string;
}

/** Current user (memoised per request). Supabase in production, signed cookie locally. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  if (isSupabaseAuth()) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    return { id: data.claims.sub as string, email: (data.claims.email as string) ?? "" };
  }
  const store = await cookies();
  return verifySession(store.get(LOCAL_COOKIE)?.value);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
