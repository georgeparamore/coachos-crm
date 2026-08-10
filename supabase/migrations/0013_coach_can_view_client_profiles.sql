-- DJS CRM: profiles' only SELECT policy was "read own row" (0001_init.sql),
-- which silently returned zero rows whenever a coach queried a client's
-- profile for display (name/email) — confirmed in testing: /clients showed
-- every real client as "Unknown client" once one actually existed, and
-- /students has the same join so it's affected too. Adds a second SELECT
-- policy (RLS policies for the same command OR together, so this is
-- additive — "read own row" still applies for everyone reading themselves)
-- scoped through coach_client_memberships, matching the ownership model in
-- docs/architecture-decisions.md.

create policy "profiles: coach can view own clients' profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.coach_client_memberships m
      where m.client_id = profiles.id and m.coach_id = auth.uid()
    )
  );
