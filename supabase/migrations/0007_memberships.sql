-- CoachOS Phase 3: coach/client membership lifecycle + platform admin bootstrap.
-- Run via `supabase db push` or paste into the Supabase SQL editor, against a
-- STAGING project first — see docs/architecture-decisions.md before applying
-- to production. Depends on 0001_init.sql (profiles, set_updated_at()).

-- ---------------------------------------------------------------------------
-- coach_client_memberships: the only source of truth for "does this client
-- have access to this coach's courses/community/directory/events." Never
-- infer client access from profiles.role = 'client' alone — see
-- docs/architecture-decisions.md's ownership & access model.
-- ---------------------------------------------------------------------------
create type public.membership_status as enum (
  'invited',
  'active',
  'revoked'
);

create table if not exists public.coach_client_memberships (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  status public.membership_status not null default 'invited',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A client may belong to more than one coach (schema allows it, per the
-- accepted decision), but not have two membership rows for the *same* coach.
create unique index if not exists coach_client_memberships_coach_client_uniq
  on public.coach_client_memberships (coach_id, client_id);

create index if not exists coach_client_memberships_coach_id_idx
  on public.coach_client_memberships (coach_id);
create index if not exists coach_client_memberships_client_id_idx
  on public.coach_client_memberships (client_id);
create index if not exists coach_client_memberships_status_idx
  on public.coach_client_memberships (status);

alter table public.coach_client_memberships enable row level security;

-- Coach: full control over memberships they own (invite, revoke, etc).
create policy "memberships: coach full access to own rows"
  on public.coach_client_memberships for all
  using (
    coach_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  )
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );

-- Client: can see their own memberships (across however many coaches).
create policy "memberships: client can view own memberships"
  on public.coach_client_memberships for select
  using (client_id = auth.uid());

-- Client: can accept a pending invitation for themselves, and nothing else —
-- the using/with check pair only allows the invited -> active transition on
-- a row that's already theirs; it can't be used to create rows, change the
-- coach_id, or move a row into any other status.
create policy "memberships: client can accept own invitation"
  on public.coach_client_memberships for update
  using (client_id = auth.uid() and status = 'invited')
  with check (client_id = auth.uid() and status = 'active');

drop trigger if exists coach_client_memberships_set_updated_at on public.coach_client_memberships;
create trigger coach_client_memberships_set_updated_at
  before update on public.coach_client_memberships
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- platform_admins: CoachOS operators, distinct from coaches. Replaces the
-- single-ADMIN_EMAIL-env-var check. Service-role-only, same convention as
-- error_logs (0006) — RLS enabled, zero policies, so anon/authenticated get
-- nothing; all reads/writes go through the service-role key from trusted
-- server code. Bootstrapping the first row is a manual SQL/dashboard action,
-- not an app flow — see docs/architecture-decisions.md.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  id uuid primary key references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policies: intentional, see comment above.
