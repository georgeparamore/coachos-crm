# Architecture decisions — Phase 3 and beyond

This records the product/technical decisions locked in at the start of Phase 3, per the
phased build plan (Phases 3–8, following the shipped Phase 1/2 CRM + billing work). Treat
this as the source of truth when a later phase's spec seems to conflict with an earlier
assumption — update this file in the same PR that changes the decision.

## Accepted defaults

All seven defaults recommended in the phased plan are accepted as-is:

1. **One canonical CRM pipeline.** The real `leads` table keeps its existing stages
   (`new`, `in_conversation`, `proposal_sent`, `signed`). The `/community-demo` mockup's
   simpler four-stage labels (New/Contacted/Follow up/Closed) were a UX exploration only —
   they do not drive a schema change. If friendlier copy is wanted later, it's a display-layer
   mapping, not an enum migration.
2. **Ad metrics are separate from lead records.** Meta campaign/spend/impressions/clicks data
   lives in dedicated `meta_*` tables (Phase 4), never in `public.leads`. Identifiable Lead Ads
   submissions (Phase 4B, optional/deferred), if ever ingested, upsert into `public.leads` by
   stable external ID with `source = 'meta'` — they don't create a second pipeline.
3. **The public marketing-site contact form is a distinct concept**, already implemented at
   `/api/leads` for the unrelated Full Circle Labs site. It is not part of the CoachOS CRM and
   is not touched by this plan. (No physical table rename performed — it doesn't share a table
   with `public.leads`; the two just share the English word "leads." No action needed beyond
   this note.)
4. **Single-coach product scope on a multi-tenant-safe schema.** Every new business table
   carries `coach_id` (or derives access through a membership row that carries it) and ships
   with tested RLS. Custom domains, per-coach branding, cross-coach discovery, and
   platform-level moderation UI are explicitly out of scope for now.
5. **Bunny Stream is the production video path** (Phase 5). An external-video-URL field may
   exist as a dev/import convenience but is not the primary path and is not exposed as a
   first-class authoring option in the UI.
6. **Community v1 uses refetch/polling**, not Supabase Realtime. Data access is structured so
   Realtime can be layered in later without a domain-model change, but it is not a Phase 6
   launch dependency.
7. **Meta Ads (Phase 4) ships before Courses/Community (Phases 5–6)**, since it's the new
   business driver and has external approval lead time (Meta business verification). Meta
   account/app setup starts in parallel with the rest of Phase 3.

## Decisions required before Phase 3 exit — resolved

| Decision | Resolution |
|---|---|
| How does a client become associated with a coach? | **Invitation only** for v1. No public client self-signup. |
| Can one client belong to more than one coach? | **Supported in schema** (`coach_client_memberships` has no uniqueness constraint forcing one row per client), but the **UI exposes only one active coach relationship at a time** in v1. |
| Will coaches have assistants/staff (workspace model)? | **No, not yet.** Retain the simpler model: `coach_id` = the coach's own `auth.users.id` directly, no `coach_workspaces`/`workspace_memberships` layer. Revisit before any phase that would otherwise hard-code "one coach owns this row" if multi-staff support becomes a near-term need. |
| Platform administrator bootstrap/revocation | A private `public.platform_admins` table (service-role-only access, no client RLS grants), managed only via direct SQL/service-role operations — never via user-editable `profiles` or `app_metadata`. Replaces the current single-`ADMIN_EMAIL`-env-var check. **Code that reads `ADMIN_EMAIL` (`/admin/errors` gating) is not yet migrated to this table — tracked as follow-up, not done in this pass.** |
| Phase 4 scope: aggregate reporting only, or also Lead Ads ingestion? | **4A (aggregate reporting) only** for the initial build. 4B (identifiable Lead Ads ingestion) stays explicitly optional/deferred until requested. |

## Ownership & access model (for schema authors)

- **`coach_id` columns** point directly at `auth.users.id` (via `profiles.id`) for coach-owned
  resources — courses, community posts/categories, Meta connections, etc. This mirrors the
  existing `leads`/`events` convention.
- **Client access is never inferred from `profiles.role = 'client'` alone.** It's derived from
  an active row in `public.coach_client_memberships` (coach_id, client_id, status,
  invited_at, accepted_at, revoked_at). A client with no active membership for a given coach
  has no access to that coach's courses/community/directory/events, even if their role is
  `client`.
- **RLS pattern for coach-owned tables**: `using (coach_id = auth.uid()) with check (coach_id
  = auth.uid())`, following `events`/`leads`.
- **RLS pattern for client-readable tables** (published courses, community posts, etc.): a
  second policy granting `select` where `exists (select 1 from coach_client_memberships m
  where m.coach_id = <row>.coach_id and m.client_id = auth.uid() and m.status = 'active')`.
- **Service-role-only tables** (Meta token storage, `platform_admins`): RLS enabled, zero
  policies — identical to the existing `error_logs` convention. All access goes through
  server-only code using the service-role key.

## Migration plan for this pass

New migrations, following the `NNNN_description.sql` numbering and per-table conventions
(`gen_random_uuid()` PKs, `coach_id` FK to `profiles`, `created_at`/`updated_at` with the
existing shared `set_updated_at()` trigger, an index per FK/filter column, RLS enabled with
explicit policies or explicit no-policy service-role-only tables):

- `0007_memberships.sql` — `coach_client_memberships`, `platform_admins`
- `0008_courses.sql` — `courses`, `course_modules`, `lessons`, `enrollments`, `lesson_progress`
- `0009_community.sql` — `community_categories`, `community_posts`, `community_comments`,
  `community_reactions` (announcements = `community_posts.is_announcement`; moderation =
  `community_posts.moderation_status` / `deleted_at` rather than a separate table, to keep v1
  lean — revisit if moderation needs grow)
- `0010_notifications.sql` — `notification_preferences`, `notification_deliveries`
- `0011_meta_ads.sql` — `meta_connections`, `meta_ad_accounts`, `meta_sync_runs`,
  `meta_campaigns`, `meta_ad_insights_daily`

These migrations are **written but not applied to any Supabase project** — this repo's
local/session Supabase env vars are placeholders (no real project connected in this
environment). They *were* however verified to apply cleanly, in order, against a real local
Postgres 16 instance (stubbing only `auth.users`/`auth.uid()`, the Supabase-managed pieces
this repo doesn't own) — 0001 through 0011 run end-to-end with no errors, 26 tables and 40
RLS policies created, no truncated identifiers. That catches syntax errors, FK/ordering bugs,
and duplicate-name collisions; it does **not** prove the RLS policies behave correctly under
real auth sessions. Before running against a real project: review each file, run
`supabase db push` (or paste into the SQL editor) against a **staging** project first, and
exercise the two-coach RLS fixtures called for in the plan's Phase 3 exit criteria (this still
needs real Supabase auth sessions to test properly — a local Postgres stub can't fake JWT-based
`auth.uid()` behavior convincingly enough to trust for security testing) before touching
production.

## Explicitly not done in this pass

Per the plan's own phase boundaries, the following are designed (schema exists) but not
built in this pass, and shouldn't be inferred as done:

- No application code/UI for courses, community, notifications, or Meta yet — schema only.
- No Meta developer app, Bunny Stream account, or email provider account has been created —
  those are external, human-driven steps (see the plan's "Infrastructure/accounts" sections).
- `ADMIN_EMAIL` → `platform_admins` code migration not yet done (table exists, call sites
  unchanged).
- Feature-flag/config strategy (so Meta/Bunny/community/notifications can be toggled per
  environment) is not yet implemented — flagged here as still owed before Phase 4 UI ships.
