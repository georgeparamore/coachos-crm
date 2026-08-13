-- Launch readiness: in-app notification read state and a durable contact
-- timeline for lead follow-up accountability.

alter table public.notification_deliveries add column read_at timestamptz;
create index notification_deliveries_unread_idx
  on public.notification_deliveries (profile_id, created_at desc) where read_at is null;

create policy "notification_deliveries: user can mark own notifications read"
  on public.notification_deliveries for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

alter table public.leads add column last_contacted_at timestamptz;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  activity_type text not null check (activity_type in ('call', 'email', 'text', 'note')),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index lead_activities_lead_time_idx on public.lead_activities (lead_id, occurred_at desc);
alter table public.lead_activities enable row level security;
create policy "lead_activities: coach full access to own activity"
  on public.lead_activities for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);
grant select, insert, update, delete on public.lead_activities to authenticated;

create or replace function public.touch_lead_from_activity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.activity_type in ('call', 'email', 'text') then
    update public.leads set last_contacted_at = new.occurred_at where id = new.lead_id and coach_id = new.coach_id;
  end if;
  return new;
end;
$$;
create trigger lead_activity_touch_lead after insert on public.lead_activities
  for each row execute procedure public.touch_lead_from_activity();
