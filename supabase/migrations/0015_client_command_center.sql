-- DJS CRM: durable private coaching notes and direct client-linked calendar events.
-- Both resources remain coach-owned and protected by RLS. A coach may only
-- attach notes/events to a client who has a non-revoked membership with them.

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_notes_coach_client_idx
  on public.client_notes (coach_id, client_id, created_at desc);
create index if not exists client_notes_client_id_idx on public.client_notes (client_id);

alter table public.client_notes enable row level security;

grant select, insert, update, delete on public.client_notes to authenticated;

create policy "client_notes: coach manages notes for own clients"
  on public.client_notes for all
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and exists (
      select 1 from public.coach_client_memberships membership
      where membership.coach_id = (select auth.uid())
        and membership.client_id = client_notes.client_id
        and membership.status <> 'revoked'
    )
  );

drop trigger if exists client_notes_set_updated_at on public.client_notes;
create trigger client_notes_set_updated_at
  before update on public.client_notes
  for each row execute procedure public.set_updated_at();

alter table public.events
  add column if not exists client_id uuid references public.profiles (id) on delete set null;

create index if not exists events_client_id_idx on public.events (client_id);

drop policy if exists "events: coach full access to own rows" on public.events;
create policy "events: coach full access to own rows"
  on public.events for all
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and (
      client_id is null
      or exists (
        select 1 from public.coach_client_memberships membership
        where membership.coach_id = (select auth.uid())
          and membership.client_id = events.client_id
          and membership.status <> 'revoked'
      )
    )
  );
