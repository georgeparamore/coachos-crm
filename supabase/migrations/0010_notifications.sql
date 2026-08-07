-- CoachOS Phase 7: notification preferences + a durable delivery outbox.
-- Run via `supabase db push` or paste into the Supabase SQL editor, against a
-- STAGING project first — see docs/architecture-decisions.md before applying
-- to production. Depends on 0001_init.sql (profiles, set_updated_at()).
--
-- This is the schema only. The scheduler/worker that turns pending rows in
-- notification_deliveries into actual sent email (Resend) is Phase 7
-- application code, not part of this migration.

-- ---------------------------------------------------------------------------
-- notification_preferences: one row per user. event_settings is a jsonb map
-- of event-type -> enabled (e.g. {"event_reminder": true, "announcement":
-- false}) so new event types don't require a schema migration — the
-- application defines the known keys and treats a missing key as "enabled"
-- unless it's a required-transactional event type (never suppressible).
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  event_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences: user full access to own row"
  on public.notification_preferences for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute procedure public.set_updated_at();

-- Seed a default preferences row whenever a profile is created, same pattern
-- as handle_new_user() in 0001_init.sql.
create or replace function public.handle_new_profile_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_notification_preferences on public.profiles;
create trigger on_profile_created_notification_preferences
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile_notification_preferences();

-- ---------------------------------------------------------------------------
-- notification_deliveries: the outbox. Application/job code (service role)
-- inserts pending rows and updates them as they're attempted; the scheduler
-- is expected to be idempotent via idempotency_key (e.g. "event_reminder:
-- <event_id>:<24h-before>"). Recipients can read their own delivery history
-- (useful for an in-app notification list) but never write to it directly —
-- no insert/update/delete policy for authenticated users, only for the
-- service role, which bypasses RLS.
-- ---------------------------------------------------------------------------
create type public.notification_delivery_status as enum (
  'pending',
  'sent',
  'failed'
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  channel text not null default 'email',
  payload jsonb not null default '{}'::jsonb,
  status public.notification_delivery_status not null default 'pending',
  scheduled_for timestamptz not null default now(),
  attempt_count integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_deliveries_idempotency_key_uniq
  on public.notification_deliveries (idempotency_key) where idempotency_key is not null;
create index if not exists notification_deliveries_profile_id_idx on public.notification_deliveries (profile_id);
create index if not exists notification_deliveries_status_scheduled_idx
  on public.notification_deliveries (status, scheduled_for);

alter table public.notification_deliveries enable row level security;

create policy "notification_deliveries: user can view own delivery history"
  on public.notification_deliveries for select
  using (profile_id = auth.uid());

drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute procedure public.set_updated_at();
