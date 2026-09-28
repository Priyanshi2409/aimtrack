-- Hardening: tables are also reachable through Supabase's auto-generated REST API with a
-- user's own JWT, so rows that enforce limits must not be user-editable.

-- AI usage log: users may read and append, but never edit or delete (rate limits stay honest).
drop policy if exists "own rows" on public.ai_calls;
drop policy if exists "read own ai calls" on public.ai_calls;
drop policy if exists "log own ai calls" on public.ai_calls;
create policy "read own ai calls" on public.ai_calls for select to authenticated using (user_id = auth.uid());
create policy "log own ai calls" on public.ai_calls for insert to authenticated with check (user_id = auth.uid());
revoke update, delete on public.ai_calls from authenticated;

-- Profiles: users can change their name/timezone/onboarding flag, not the demo flag.
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, onboarded) on public.profiles to authenticated;
revoke insert on public.profiles from authenticated;
grant insert (id, display_name, timezone, onboarded) on public.profiles to authenticated;

-- Anonymous (signed-out) API access has no use in AimTrack.
revoke all on all tables in schema public from anon;
