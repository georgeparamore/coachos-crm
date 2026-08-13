-- Separate the coach-facing Full Circle CRM brand from business-specific
-- student school portals.

alter table public.businesses add column portal_name text;
alter table public.businesses add column portal_tagline text not null default 'Learn, connect, and grow.';
alter table public.businesses add column portal_enabled boolean not null default true;
update public.businesses set portal_name = name where portal_name is null;
alter table public.businesses alter column portal_name set not null;

alter table public.coach_client_memberships add column business_id uuid references public.businesses (id) on delete restrict;
update public.coach_client_memberships m set business_id = b.id
from public.businesses b where b.coach_id = m.coach_id and b.is_default and m.business_id is null;
alter table public.coach_client_memberships alter column business_id set not null;
drop index if exists public.coach_client_memberships_coach_client_uniq;
create unique index coach_client_memberships_business_client_uniq
  on public.coach_client_memberships (business_id, client_id);
create index coach_client_memberships_business_id_idx on public.coach_client_memberships (business_id);

alter table public.courses add column business_id uuid references public.businesses (id) on delete restrict;
update public.courses c set business_id = b.id
from public.businesses b where b.coach_id = c.coach_id and b.is_default and c.business_id is null;
alter table public.courses alter column business_id set not null;
create index courses_business_id_idx on public.courses (business_id);

alter table public.enrollments add column business_id uuid references public.businesses (id) on delete restrict;
update public.enrollments e set business_id = c.business_id from public.courses c where c.id = e.course_id;
alter table public.enrollments alter column business_id set not null;
create index enrollments_business_id_idx on public.enrollments (business_id);

create or replace function public.enrollments_set_coach_id()
returns trigger language plpgsql set search_path = public as $$
begin
  select c.coach_id, c.business_id into new.coach_id, new.business_id from public.courses c where c.id = new.course_id;
  return new;
end;
$$;

create trigger courses_guard_business before insert or update of business_id, coach_id on public.courses
  for each row execute procedure public.guard_business_ownership();
create trigger memberships_guard_business before insert or update of business_id, coach_id on public.coach_client_memberships
  for each row execute procedure public.guard_business_ownership();
