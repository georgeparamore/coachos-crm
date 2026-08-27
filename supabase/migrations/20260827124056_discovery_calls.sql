-- Automated Zoom discovery-call intake for the multi-business CRM.
-- Zoom/OpenAI credentials remain in server environment variables; these
-- tables hold only business routing, recording metadata, transcripts, and
-- coach-visible project briefs.

create table public.discovery_call_integrations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete restrict,
  zoom_account_id text not null,
  host_email text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zoom_account_id)
);

create index discovery_call_integrations_coach_idx
  on public.discovery_call_integrations (coach_id, enabled);

alter table public.discovery_call_integrations enable row level security;
create policy "discovery call integrations: coach manages own rows"
  on public.discovery_call_integrations for all
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

drop trigger if exists discovery_call_integrations_set_updated_at on public.discovery_call_integrations;
create trigger discovery_call_integrations_set_updated_at
  before update on public.discovery_call_integrations
  for each row execute procedure public.set_updated_at();

create table public.discovery_calls (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete restrict,
  integration_id uuid not null references public.discovery_call_integrations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  client_id uuid references public.profiles (id) on delete set null,
  zoom_event_id text,
  zoom_meeting_uuid text not null,
  zoom_meeting_id text,
  topic text not null default 'Discovery call',
  host_email text,
  participant_emails text[] not null default '{}',
  started_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  recording_completed_at timestamptz,
  recording_file_id text,
  recording_file_type text,
  recording_file_size bigint check (recording_file_size is null or recording_file_size >= 0),
  recording_download_url text,
  recording_play_url text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  transcript text,
  project_brief jsonb,
  processing_attempts integer not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, zoom_meeting_uuid)
);

create index discovery_calls_coach_created_idx
  on public.discovery_calls (coach_id, created_at desc);
create index discovery_calls_business_created_idx
  on public.discovery_calls (business_id, created_at desc);
create index discovery_calls_lead_idx
  on public.discovery_calls (lead_id) where lead_id is not null;
create index discovery_calls_processing_idx
  on public.discovery_calls (status, updated_at)
  where status in ('queued', 'failed');

alter table public.discovery_calls enable row level security;
create policy "discovery calls: coach manages own rows"
  on public.discovery_calls for all
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

drop trigger if exists discovery_calls_set_updated_at on public.discovery_calls;
create trigger discovery_calls_set_updated_at
  before update on public.discovery_calls
  for each row execute procedure public.set_updated_at();

-- Prevent a caller from attaching a call to another coach's business, lead,
-- client, or Zoom integration even if they bypass the UI.
create or replace function public.guard_discovery_call_ownership()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.businesses business
    where business.id = new.business_id and business.coach_id = new.coach_id
  ) then
    raise exception 'Business must belong to the same coach';
  end if;

  if not exists (
    select 1 from public.discovery_call_integrations integration
    where integration.id = new.integration_id
      and integration.coach_id = new.coach_id
      and integration.business_id = new.business_id
  ) then
    raise exception 'Zoom integration must belong to the same coach and business';
  end if;

  if new.lead_id is not null and not exists (
    select 1 from public.leads lead
    where lead.id = new.lead_id
      and lead.coach_id = new.coach_id
      and lead.business_id = new.business_id
  ) then
    raise exception 'Lead must belong to the same coach and business';
  end if;

  if new.client_id is not null and not exists (
    select 1 from public.coach_client_memberships membership
    where membership.coach_id = new.coach_id
      and membership.client_id = new.client_id
      and membership.business_id = new.business_id
      and membership.status <> 'revoked'
  ) then
    raise exception 'Client must belong to the same coach and business';
  end if;

  return new;
end;
$$;

create trigger discovery_calls_guard_ownership
  before insert or update of coach_id, business_id, integration_id, lead_id, client_id
  on public.discovery_calls
  for each row execute procedure public.guard_discovery_call_ownership();

create trigger discovery_call_integrations_guard_business
  before insert or update of coach_id, business_id
  on public.discovery_call_integrations
  for each row execute procedure public.guard_business_ownership();

grant select, insert, update, delete
  on public.discovery_call_integrations, public.discovery_calls
  to authenticated;
