import "server-only";
import { supabaseAdmin } from "@/lib/auth/supabase";
import { db, withUser } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";
import { env, isSupabaseAuth } from "@/lib/env";
import { seedSampleGoals } from "./sample";

/** Creates (or finds) the shared demo account. Supabase Admin API in prod, local auth table otherwise. */
export async function ensureDemoUser(): Promise<string> {
  if (isSupabaseAuth() && env.supabaseServiceKey) {
    const admin = supabaseAdmin();
    const [existing] = await db()`select id from auth.users where email = ${env.demoEmail}`;
    if (existing) {
      // Keep the password in sync with the configured value.
      await admin.auth.admin.updateUserById(existing.id as string, { password: env.demoPassword });
      return existing.id as string;
    }
    const { data, error } = await admin.auth.admin.createUser({ email: env.demoEmail, password: env.demoPassword, email_confirm: true, user_metadata: { name: "Demo" } });
    if (error || !data.user) throw new Error(`Could not create demo user: ${error?.message}`);
    return data.user.id;
  }
  const [row] = await db()`
    insert into auth.users (email, encrypted_password) values (${env.demoEmail}, crypt(${env.demoPassword}, gen_salt('bf')))
    on conflict (email) do update set email = excluded.email returning id`;
  return row.id as string;
}

/** Wipes and re-creates the demo account's data so its history is always relative to today. */
export async function reseedDemo() {
  const id = await ensureDemoUser();
  await withUser(id, async (tx) => {
    await repo.ensureProfile(tx, id, "Priya (demo)");
  });
  // is_demo can't be self-granted through RLS-scoped updates in the app, so set it directly.
  await db()`update profiles set is_demo = true, onboarded = true, display_name = 'Priya (demo)' where id = ${id}`;
  await db()`delete from ai_calls where user_id = ${id}`; // fresh daily AI budget for demo visitors
  const n = await seedSampleGoals(id, { replace: true });
  return { id, goals: n };
}
