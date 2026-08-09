-- DJS CRM Phase 5: client invites. Bridges the gap coach_client_memberships
-- has on its own — that table's client_id is NOT NULL against profiles, so
-- a membership row can't exist until the invitee already has an account.
-- client_invites is the email-only pending state that comes before that:
-- coach creates one, invitee follows a tokenized link to /invite/[token],
-- creates their account there, and a service-role route both creates their
-- profile (role: client) and the resulting coach_client_memberships row in
-- one step. See docs/architecture-decisions.md for the ownership model this
-- extends. Depends on 0001_init.sql (profiles, set_updated_at()) and
-- 0007_memberships.sql (coach_client_memberships).

create type public.client_invite_status as enum (
  'pending',
  'accepted',
  'revoked'
);

create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  full_name text,
  token text not null,
  status public.client_invite_status not null default 'pending',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_invites_token_uniq on public.client_invites (token);
-- One pending invite per (coach, email) at a time — resending means revoking
-- the old one first, not silently piling up duplicates.
create unique index if not exists client_invites_coach_email_pending_uniq
  on public.client_invites (coach_id, lower(email))
  where status = 'pending';
create index if not exists client_invites_coach_id_idx on public.client_invites (coach_id);

alter table public.client_invites enable row level security;

create policy "client_invites: coach full access to own rows"
  on public.client_invites for all
  using (
    coach_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  )
  with check (
    coach_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach')
  );
-- No client/anonymous policy: the public /invite/[token] accept page has no
-- session to satisfy coach_id = auth.uid(), so token lookups and the accept
-- mutation both go through the service role in the API route, not RLS.

drop trigger if exists client_invites_set_updated_at on public.client_invites;
create trigger client_invites_set_updated_at
  before update on public.client_invites
  for each row execute procedure public.set_updated_at();
