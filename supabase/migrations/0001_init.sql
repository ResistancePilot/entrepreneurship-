-- PIXEL EMPIRE schema.
-- All writes happen in the `game` Edge Function through a direct DB connection (service role / postgres),
-- which bypasses RLS. The browser (anon key) can only SELECT the public tables below, for Realtime.
-- Secrets (token hashes) and private decisions live in tables with RLS enabled and NO policies.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  status text not null default 'lobby' check (status in ('lobby','open','results','finished')),
  round int not null default 0 check (round between 0 and 8),
  seed text not null,
  event_id text,
  round_opened_at timestamptz,
  final jsonb,
  version int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.game_secrets (
  game_id uuid primary key references public.games(id) on delete cascade,
  admin_token_hash text not null
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 24),
  business text not null,
  state jsonb not null,
  cash int not null default 10000,
  net_earnings int not null default 0,
  rank int not null default 1,
  prev_rank int not null default 1,
  submitted boolean not null default false,
  last jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists teams_game_name_uq on public.teams (game_id, lower(name));
create index if not exists teams_game_idx on public.teams (game_id);

create table if not exists public.team_secrets (
  team_id uuid primary key references public.teams(id) on delete cascade,
  token_hash text not null
);

-- Private until the round closes.
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  round int not null,
  decision jsonb not null,
  updated_at timestamptz not null default now(),
  unique (team_id, round)
);

create table if not exists public.round_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  round int not null,
  event_id text not null,
  submitted boolean not null,
  decision jsonb not null,
  start_cash int not null,
  result jsonb not null,
  explanation jsonb not null,
  rank int not null,
  created_at timestamptz not null default now(),
  unique (team_id, round)   -- a round can only be calculated once per team
);
create index if not exists round_results_game_idx on public.round_results (game_id, round);

-- RLS: lock everything, then allow anon/authenticated to read the public tables only.
alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.teams enable row level security;
alter table public.team_secrets enable row level security;
alter table public.submissions enable row level security;
alter table public.round_results enable row level security;

drop policy if exists "public read games" on public.games;
create policy "public read games" on public.games for select to anon, authenticated using (true);
drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams for select to anon, authenticated using (true);
drop policy if exists "public read results" on public.round_results;
create policy "public read results" on public.round_results for select to anon, authenticated using (true);

revoke all on public.game_secrets, public.team_secrets, public.submissions from anon, authenticated;
revoke insert, update, delete on public.games, public.teams, public.round_results from anon, authenticated;

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.games; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.teams; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.round_results; exception when duplicate_object then null; end;
  end if;
end $$;
