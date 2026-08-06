-- CoachOS Phase 4: Meta (Facebook/Instagram) Ads connection + cached
-- campaign performance. Run via `supabase db push` or paste into the
-- Supabase SQL editor, against a STAGING project first — see
-- docs/architecture-decisions.md before applying to production. Depends on
-- 0001_init.sql (profiles, set_updated_at()).
--
-- Security model: meta_connections holds encrypted token material and is
-- SERVICE-ROLE-ONLY (RLS enabled, zero policies) — never queried directly
-- from the browser, per the plan's "never expose app secrets or access
-- tokens to the browser." A server route reads/writes it with the
-- service-role key and exposes only a derived connection-status shape
-- (connected: bool, account name, last sync time — no token material) to
-- the client. Every other table here denormalizes coach_id directly (rather
-- than joining back to meta_connections in RLS) specifically so coach-scoped
-- SELECT policies work without needing to read the locked-down connections
-- table — see docs/architecture-decisions.md's ownership & access model.
--
-- Phase 4A (aggregate reporting) only — no Lead Ads ingestion table here;
-- that's optional Phase 4B, deferred until requested.

-- ---------------------------------------------------------------------------
-- meta_connections: one Meta login per coach for v1. Service-role-only.
-- ---------------------------------------------------------------------------
create type public.meta_connection_status as enum (
  'active',
  'disconnected',
  'error'
);

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  meta_user_id text not null,
  status public.meta_connection_status not null default 'active',
  -- Nullable: a disconnect clears this (revokes locally, best-effort revokes
  -- with Meta too) while keeping the row for connection history.
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_validated_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists meta_connections_coach_id_uniq on public.meta_connections (coach_id);

alter table public.meta_connections enable row level security;
-- No policies: service-role-only, see file header.

drop trigger if exists meta_connections_set_updated_at on public.meta_connections;
create trigger meta_connections_set_updated_at
  before update on public.meta_connections
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meta_ad_accounts: the ad account(s) available under a connection, and
-- which one the coach has selected. Not secret (id/name/currency/timezone
-- only) — coach-readable directly, so the "choose your ad account" UI can
-- query it via the normal session-scoped Supabase client like the rest of
-- the app, rather than needing a dedicated API route.
-- ---------------------------------------------------------------------------
create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_ad_account_id text not null,
  name text not null,
  currency text not null default 'USD',
  timezone text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists meta_ad_accounts_connection_account_uniq
  on public.meta_ad_accounts (connection_id, meta_ad_account_id);
create index if not exists meta_ad_accounts_coach_id_idx on public.meta_ad_accounts (coach_id);

alter table public.meta_ad_accounts enable row level security;

create policy "meta_ad_accounts: coach can view own accounts"
  on public.meta_ad_accounts for select
  using (coach_id = auth.uid());
-- Insert/update/delete stay service-role-only (populated by the sync job
-- from Meta's API, not user-editable beyond which one is_selected, which
-- goes through a server action rather than a direct client write).

drop trigger if exists meta_ad_accounts_set_updated_at on public.meta_ad_accounts;
create trigger meta_ad_accounts_set_updated_at
  before update on public.meta_ad_accounts
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meta_sync_runs: audit trail for each sync attempt. Operational metadata
-- only (timestamps, counts, error text) — coach-readable so the dashboard
-- can show "last synced X ago" / stale / failed state directly.
-- ---------------------------------------------------------------------------
create type public.meta_sync_status as enum (
  'running',
  'success',
  'partial',
  'failed'
);

create table if not exists public.meta_sync_runs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  status public.meta_sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  campaigns_synced integer not null default 0,
  insights_synced integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists meta_sync_runs_coach_id_idx on public.meta_sync_runs (coach_id);
create index if not exists meta_sync_runs_connection_started_idx on public.meta_sync_runs (connection_id, started_at desc);

alter table public.meta_sync_runs enable row level security;

create policy "meta_sync_runs: coach can view own sync history"
  on public.meta_sync_runs for select
  using (coach_id = auth.uid());
-- Writes are service-role-only (the sync job itself).

-- ---------------------------------------------------------------------------
-- meta_campaigns: campaign hierarchy, refreshed by the sync job.
-- ---------------------------------------------------------------------------
create table if not exists public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_campaign_id text not null,
  name text not null,
  meta_status text, -- Meta's own status string, e.g. ACTIVE / PAUSED / ARCHIVED
  objective text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists meta_campaigns_connection_campaign_uniq
  on public.meta_campaigns (connection_id, meta_campaign_id);
create index if not exists meta_campaigns_coach_id_idx on public.meta_campaigns (coach_id);

alter table public.meta_campaigns enable row level security;

create policy "meta_campaigns: coach can view own campaigns"
  on public.meta_campaigns for select
  using (coach_id = auth.uid());
-- Writes are service-role-only (the sync job).

drop trigger if exists meta_campaigns_set_updated_at on public.meta_campaigns;
create trigger meta_campaigns_set_updated_at
  before update on public.meta_campaigns
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meta_ad_insights_daily: one row per (campaign, day) — the cached numbers
-- the dashboard actually reads. Money stored as integer cents to match the
-- existing `value_cents` convention on `leads`.
-- ---------------------------------------------------------------------------
create table if not exists public.meta_ad_insights_daily (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid not null references public.meta_campaigns (id) on delete cascade,
  date date not null,
  spend_cents integer not null default 0,
  impressions bigint not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0, -- Meta-reported lead/conversion count, NOT public.leads rows — see docs/architecture-decisions.md
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists meta_ad_insights_daily_campaign_date_uniq
  on public.meta_ad_insights_daily (campaign_id, date);
create index if not exists meta_ad_insights_daily_coach_id_idx on public.meta_ad_insights_daily (coach_id);
create index if not exists meta_ad_insights_daily_date_idx on public.meta_ad_insights_daily (coach_id, date);

alter table public.meta_ad_insights_daily enable row level security;

create policy "meta_ad_insights_daily: coach can view own insights"
  on public.meta_ad_insights_daily for select
  using (coach_id = auth.uid());
-- Writes are service-role-only (the sync job). Upserts should be idempotent
-- on (campaign_id, date) — a re-run for the same day overwrites, it doesn't
-- duplicate or double-count.

drop trigger if exists meta_ad_insights_daily_set_updated_at on public.meta_ad_insights_daily;
create trigger meta_ad_insights_daily_set_updated_at
  before update on public.meta_ad_insights_daily
  for each row execute procedure public.set_updated_at();
