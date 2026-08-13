-- Meta Instant Form lead ingestion. Identifiable submissions land in the
-- existing CRM pipeline; webhook payloads remain service-role-only.

alter table public.leads add column if not exists external_source text;
alter table public.leads add column if not exists external_id text;
alter table public.leads add column if not exists source_details jsonb not null default '{}'::jsonb;

create unique index if not exists leads_external_identity_uniq
  on public.leads (coach_id, external_source, external_id)
  where external_id is not null;

create table if not exists public.meta_lead_sources (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  meta_page_id text not null,
  page_name text,
  meta_form_id text,
  form_name text,
  enabled boolean not null default true,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists meta_lead_sources_identity_uniq
  on public.meta_lead_sources (coach_id, meta_page_id, coalesce(meta_form_id, ''));
create index if not exists meta_lead_sources_lookup_idx
  on public.meta_lead_sources (meta_page_id, meta_form_id) where enabled;
alter table public.meta_lead_sources enable row level security;
create policy "meta_lead_sources: coach can view own sources"
  on public.meta_lead_sources for select using (coach_id = auth.uid());
drop trigger if exists meta_lead_sources_set_updated_at on public.meta_lead_sources;
create trigger meta_lead_sources_set_updated_at before update on public.meta_lead_sources
  for each row execute procedure public.set_updated_at();

create type public.meta_lead_event_status as enum ('received', 'processed', 'duplicate', 'unmapped', 'failed');
create table if not exists public.meta_lead_webhook_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles (id) on delete set null,
  source_id uuid references public.meta_lead_sources (id) on delete set null,
  meta_page_id text not null,
  meta_form_id text,
  meta_leadgen_id text not null unique,
  status public.meta_lead_event_status not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meta_lead_events_status_idx on public.meta_lead_webhook_events (status, created_at);
alter table public.meta_lead_webhook_events enable row level security;
drop trigger if exists meta_lead_events_set_updated_at on public.meta_lead_webhook_events;
create trigger meta_lead_events_set_updated_at before update on public.meta_lead_webhook_events
  for each row execute procedure public.set_updated_at();
