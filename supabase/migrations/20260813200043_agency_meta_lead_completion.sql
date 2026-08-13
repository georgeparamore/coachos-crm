-- Complete the private CRM data model for Meta Instant Form website leads.

alter type public.lead_stage add value if not exists 'qualified';
alter type public.lead_stage add value if not exists 'consultation_booked';
alter type public.lead_stage add value if not exists 'won';
alter type public.lead_stage add value if not exists 'lost';
alter type public.lead_stage add value if not exists 'spam_disqualified';

alter table public.leads add column first_name text;
alter table public.leads add column last_name text;
alter table public.leads add column business_name text;
alter table public.leads add column website_url text;
alter table public.leads add column project_type text check (project_type is null or project_type in ('new_website', 'redesign', 'other'));
alter table public.leads add column business_description text;
alter table public.leads add column launch_timeframe text;
alter table public.leads add column budget_set_aside text;
alter table public.leads add column additional_notes text;
alter table public.leads add column assigned_to uuid references public.profiles (id) on delete set null;
alter table public.leads add column submitted_at timestamptz;
alter table public.leads add column consent_context jsonb not null default '{}'::jsonb;
alter table public.leads add column retention_until timestamptz;
alter table public.leads add column deleted_at timestamptz;
create index leads_assigned_to_idx on public.leads (assigned_to) where assigned_to is not null;
create index leads_active_search_idx on public.leads (coach_id, created_at desc) where deleted_at is null;

alter table public.lead_activities drop constraint lead_activities_activity_type_check;
alter table public.lead_activities add constraint lead_activities_activity_type_check
  check (activity_type in ('created', 'imported', 'status_changed', 'assigned', 'call', 'email', 'text', 'note', 'consultation', 'proposal', 'system'));
alter table public.lead_activities add column metadata jsonb not null default '{}'::jsonb;

alter table public.meta_lead_sources add column meta_ad_account_id text;
alter table public.meta_lead_sources add column consent_context jsonb not null default '{}'::jsonb;

alter table public.meta_lead_webhook_events add column lead_id uuid references public.leads (id) on delete set null;
alter table public.meta_lead_webhook_events add column attempt_count integer not null default 0;
alter table public.meta_lead_webhook_events add column last_attempt_at timestamptz;
alter table public.meta_lead_webhook_events add column next_retry_at timestamptz;
alter table public.meta_lead_webhook_events add column provider_payload jsonb;
alter table public.meta_lead_webhook_events add column error_code text;
create index meta_lead_events_retry_idx on public.meta_lead_webhook_events (next_retry_at)
  where status = 'failed' and next_retry_at is not null;

-- Explicit Data API grants; RLS remains the authorization layer.
grant select, insert, update, delete on public.leads, public.lead_activities to authenticated;
grant select on public.meta_lead_sources to authenticated;
