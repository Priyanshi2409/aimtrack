-- AimTrack initial schema
-- Every user-owned table carries user_id and is protected by Row Level Security.
-- The app connects through the Supabase pooler and, per request, switches to the
-- `authenticated` role with the caller's JWT claims, so these policies are enforced
-- on every query the app runs on behalf of a user.

create extension if not exists pgcrypto;

-- ───────────────────────── profiles ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  is_demo boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────────────────────── goals ─────────────────────────
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  raw_input text not null check (char_length(raw_input) between 3 and 1000),
  category text not null default 'general',
  status text not null default 'draft'
    check (status in ('draft','researching','planning','active','completed','archived')),
  context jsonb not null default '{}'::jsonb,          -- clarifying Q&A
  start_date date,
  deadline date,
  minutes_per_day int not null default 60 check (minutes_per_day between 10 and 960),
  feasibility jsonb,                                  -- {score, verdict, reasons, suggested_deadline}
  real_world_examples jsonb not null default '[]'::jsonb,
  color text not null default 'lime',
  ai_generated boolean not null default true,         -- false when produced by offline template
  last_replanned_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals(user_id, status);

-- ───────────────────────── research ─────────────────────────
create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('examples','requirements','pitfalls')),
  status text not null default 'done' check (status in ('done','failed')),
  note text,                                          -- e.g. "no reliable sources found"
  searched_urls jsonb not null default '[]'::jsonb,   -- every URL the search tool returned
  dropped_count int not null default 0,               -- claims removed because their source was not verifiable
  created_at timestamptz not null default now(),
  unique (goal_id, kind)
);

create table if not exists public.research_findings (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('examples','requirements','pitfalls')),
  title text not null,
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  source_url text not null,
  source_title text,
  created_at timestamptz not null default now()
);
create index if not exists research_goal_idx on public.research_findings(goal_id, kind);

-- ───────────────────────── roadmap ─────────────────────────
create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idx int not null,
  title text not null,
  description text,
  duration_weeks int not null check (duration_weeks between 1 and 260),
  start_date date not null,
  end_date date not null,
  weekly_targets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists phases_goal_idx on public.phases(goal_id, idx);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idx int not null,
  title text not null,
  success_criteria text not null,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists milestones_goal_idx on public.milestones(goal_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null,
  description text,
  why text,
  estimated_minutes int not null default 30 check (estimated_minutes between 5 and 480),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  resource_url text,
  resource_query text,
  scheduled_date date not null,
  original_date date not null,
  status text not null default 'pending' check (status in ('pending','done','skipped')),
  completed_at timestamptz,
  actual_minutes int check (actual_minutes is null or actual_minutes between 0 and 960),
  sort_order int not null default 0,
  moved_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_date_idx on public.tasks(user_id, scheduled_date);
create index if not exists tasks_goal_idx on public.tasks(goal_id, scheduled_date);

-- ───────────────────────── tracking ─────────────────────────
create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  energy int not null check (energy between 1 and 5),
  mood int not null check (mood between 1 and 5),
  blocker text check (blocker is null or char_length(blocker) <= 280),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.replan_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('behind','ahead','manual')),
  summary text not null,
  changes jsonb not null default '[]'::jsonb,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists replan_goal_idx on public.replan_events(goal_id, created_at desc);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete cascade,
  kind text not null default 'weekly' check (kind in ('weekly','monthly')),
  period_start date not null,
  period_end date not null,
  stats jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,        -- {summary, went_well[], slipped[], focus}
  ai_generated boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists weekly_reviews_unique
  on public.weekly_reviews(user_id, coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, period_start);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);
create index if not exists coach_goal_idx on public.coach_messages(goal_id, created_at);

-- Per-user AI call log, used for rate limiting and cost control.
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_calls_user_idx on public.ai_calls(user_id, kind, created_at desc);

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles          enable row level security;
alter table public.goals             enable row level security;
alter table public.research_runs     enable row level security;
alter table public.research_findings enable row level security;
alter table public.phases            enable row level security;
alter table public.milestones        enable row level security;
alter table public.tasks             enable row level security;
alter table public.daily_checkins    enable row level security;
alter table public.replan_events     enable row level security;
alter table public.weekly_reviews    enable row level security;
alter table public.coach_messages    enable row level security;
alter table public.ai_calls          enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['goals','research_runs','research_findings','phases','milestones','tasks',
                           'daily_checkins','replan_events','weekly_reviews','coach_messages','ai_calls']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
