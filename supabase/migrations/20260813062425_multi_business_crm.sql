-- Centralized multi-business CRM. A coach owns businesses; leads and intake
-- sources belong to one business while remaining visible in a combined view.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  color text not null default '#7667e8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index businesses_coach_slug_uniq on public.businesses (coach_id, slug);
create unique index businesses_one_default_per_coach on public.businesses (coach_id) where is_default;
create index businesses_coach_id_idx on public.businesses (coach_id);
alter table public.businesses enable row level security;
create policy "businesses: coach full access to own businesses"
  on public.businesses for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);
drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute procedure public.set_updated_at();

insert into public.businesses (coach_id, name, slug, is_default)
select id, 'Main business', 'main-business', true
from public.profiles where role = 'coach'
on conflict (coach_id, slug) do nothing;

alter table public.leads add column business_id uuid references public.businesses (id) on delete restrict;
alter table public.leads add column service_interest text;
update public.leads l set business_id = b.id
from public.businesses b where b.coach_id = l.coach_id and b.is_default and l.business_id is null;
alter table public.leads alter column business_id set not null;
create index leads_business_id_idx on public.leads (business_id);

alter table public.client_invites add column business_id uuid references public.businesses (id) on delete restrict;
update public.client_invites i set business_id = b.id
from public.businesses b where b.coach_id = i.coach_id and b.is_default and i.business_id is null;
alter table public.client_invites alter column business_id set not null;
create index client_invites_business_id_idx on public.client_invites (business_id);

alter table public.meta_lead_sources add column business_id uuid references public.businesses (id) on delete restrict;
update public.meta_lead_sources s set business_id = b.id
from public.businesses b where b.coach_id = s.coach_id and b.is_default and s.business_id is null;
alter table public.meta_lead_sources alter column business_id set not null;
create index meta_lead_sources_business_id_idx on public.meta_lead_sources (business_id);

-- Keep cross-coach business IDs out even if a client bypasses the UI.
create or replace function public.guard_business_ownership()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.businesses b where b.id = new.business_id and b.coach_id = new.coach_id) then
    raise exception 'Business must belong to the same coach';
  end if;
  return new;
end;
$$;

create trigger leads_guard_business before insert or update of business_id, coach_id on public.leads
  for each row execute procedure public.guard_business_ownership();
create trigger client_invites_guard_business before insert or update of business_id, coach_id on public.client_invites
  for each row execute procedure public.guard_business_ownership();
create trigger meta_lead_sources_guard_business before insert or update of business_id, coach_id on public.meta_lead_sources
  for each row execute procedure public.guard_business_ownership();

-- New coach accounts always start with one usable default business.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_role text;
begin
  new_role := coalesce(new.raw_user_meta_data ->> 'role', 'coach');
  insert into public.profiles (id, role, full_name, email)
  values (new.id, new_role, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  if new_role = 'coach' then
    insert into public.businesses (coach_id, name, slug, is_default)
    values (new.id, 'Main business', 'main-business', true);
  end if;
  return new;
end;
$$;

grant select, insert, update, delete on public.businesses to authenticated;
