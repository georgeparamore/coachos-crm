-- Fixes "infinite recursion detected in policy for relation profiles" from
-- 0013_coach_can_view_client_profiles.sql — that policy queries
-- coach_client_memberships, whose own "coach full access to own rows"
-- policy (0007_memberships.sql) queries profiles back, so evaluating either
-- table's RLS re-triggers the other's. Confirmed in testing: this broke
-- every page that reads profiles, not just /clients.
--
-- Standard fix: a SECURITY DEFINER function to check membership. Because it
-- runs as its owner (not the calling role), the membership lookup inside it
-- bypasses RLS entirely instead of re-evaluating coach_client_memberships'
-- policy — breaking the cycle. search_path is pinned to prevent a
-- schema-shadowing attack against a SECURITY DEFINER function.
create or replace function public.is_coach_of_client(target_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.coach_client_memberships m
    where m.client_id = target_client_id and m.coach_id = auth.uid()
  );
$$;

drop policy if exists "profiles: coach can view own clients' profiles" on public.profiles;

create policy "profiles: coach can view own clients' profiles"
  on public.profiles for select
  using (public.is_coach_of_client(profiles.id));
