# CoachOS phased build plan

This plan begins after the shipped Phase 1/2 work. Do not rebuild auth, the existing CRM, billing, contracts, calendar, error logging, or the shared design system. Treat `/community-demo` as a UX reference only; production features must use the authenticated app, Supabase data, RLS, and existing error-handling conventions.

## Recommended product decisions

Use these defaults unless the product owner explicitly overrides them:

1. **One canonical CRM pipeline.** Keep the real `leads` table and its current stages (`new`, `in_conversation`, `proposal_sent`, `signed`). Adapt the demo labels to the real stages; do not migrate the enum merely to match mockup copy. If friendlier UI wording is wanted, use a display mapping such as New / In conversation / Proposal sent / Signed.
2. **Separate ad metrics from lead records.** Aggregate Meta metrics such as `spend`, `impressions`, `clicks`, and reported lead conversions belong in ad-insight tables, not the CRM `leads` table. If identifiable Meta Lead Ads submissions are later imported, upsert them into the canonical CRM table with a stable external ID and `source = meta`; do not create another pipeline.
3. **Rename or isolate the unrelated public contact-form table in code.** It can remain physically unchanged if migration risk is not worthwhile, but its modules/types/routes should use an explicit name such as `marketing_site_inquiries` so it cannot be confused with CoachOS CRM leads.
4. **Ship single-coach product scope on a multi-tenant-safe schema.** Every new business record still gets `coach_id` and tested RLS. Defer custom domains, per-coach branding, cross-coach discovery, and platform-level moderation.
5. **Use Bunny Stream for production video.** Keep an optional external-video URL only as a development/import convenience, not as the primary production path.
6. **Use refetch/polling for community v1.** Add optimistic UI where useful. Do not make Realtime a launch dependency; introduce it only after measuring a real UX need.
7. **Prioritize Meta before courses/community.** It is the new business driver and has external approval lead time. Start Meta account/app verification immediately, in parallel with Phase 3, and ship the usable integration in Phase 4.

## Account and administration model

No second database is required. Use the existing Supabase project for authentication and application authorization, with these distinct layers:

- **Authentication:** Supabase Auth owns credentials, email verification, password reset, sessions, and provider identities in `auth.users`. Application code should not duplicate passwords or session tokens in public tables.
- **User profile:** the existing `profiles` row remains the safe application-facing identity record, keyed to the Auth user. It holds display/profile data and the coarse `coach` or `client` product role.
- **Coach workspace/ownership:** for v1, a coach is the administrator of their own tenant. Existing records may continue to use that coach user's ID as `coach_id`; document this invariant. If future support for assistants or multiple staff per coach is likely, introduce a `coach_workspaces` table plus `workspace_memberships` now and migrate ownership to `workspace_id` before adding many new modules.
- **Coach-client access:** add an explicit `coach_client_memberships` (or equivalent) table with `coach_id`, `client_id`, invitation/status fields, and timestamps. Courses, community, directory, and events derive client access from an active membership rather than from `role = client` alone.
- **Platform administration:** distinguish CoachOS operators from coaches. Replace the current single-email `ADMIN_EMAIL` check with a server-controlled `platform_admins` table in a non-exposed schema or trusted authorization claims such as Supabase `app_metadata`. Never authorize from user-editable metadata. Platform-admin operations must be server-only and audited.
- **Authorization:** enforce permissions in RLS and trusted server paths, not merely in navigation or UI. Every client request must be scoped through both authenticated user identity and the relevant coach membership/ownership relationship.

Required account flows are: coach signup and tenant bootstrap; client invitation/acceptance; login/logout; verified email; password reset; session expiration; invitation resend/revoke; client suspension/removal; coach account deletion/export; and a documented, auditable bootstrap/revocation process for platform admins. Public self-signup for clients is not required for v1.

## Phase 3 — Product foundation and schema contracts

### Goal

Lock the domain model and tenant/security boundaries needed by every remaining feature, without yet building the major user-facing modules.

### Deliverables

- Record the decisions above in the repo's architecture/product documentation.
- Inventory `/community-demo` screens and map each one to either a production route/component to adapt, a later-phase feature, or demo-only code to retire after parity.
- Define role/capability rules for coach and client across courses, community, member directory, events, and notifications. Do not rely only on client-side route hiding.
- Implement/document the account and administration model above, including platform-admin bootstrap and coach-client invitation lifecycle.
- Define a consistent ownership model: coach-owned resources carry `coach_id`; client access is derived from an explicit membership/enrollment relationship.
- Design migrations for:
  - coach/client memberships and lifecycle state;
  - courses, modules, lessons, enrollments, and lesson progress;
  - community posts, comments, reactions, categories, announcements, and moderation state;
  - notification preferences and delivery records;
  - Meta connections, ad accounts, sync runs, campaigns/ad sets/ads as needed, and daily insight snapshots.
- Establish migration conventions, indexes, uniqueness constraints, timestamps, deletion behavior, and RLS test coverage for all new tables.
- Add a feature-flag/config strategy so Meta, Bunny, community, and notifications can be enabled independently by environment.
- Define acceptance-test fixtures for at least two coaches and multiple clients, specifically proving no cross-coach reads or writes.

### Infrastructure/accounts

- Begin Meta developer app creation, business portfolio setup, business verification, privacy-policy/data-deletion URLs, and permissions/app-review preparation now; these are external critical-path tasks.
- Create non-production Bunny Stream library and restricted API credentials.
- Confirm staging Supabase and Vercel environments exist and do not share production secrets or webhook endpoints.

### Dependencies

- Existing auth/profile model and shipped RLS conventions.

### Decisions required before completion

- Accept or override the seven recommended defaults above.
- Decide how a client becomes associated with a coach: invitation only is recommended for v1.
- Decide whether one client may belong to more than one coach. Recommend supporting the relationship in schema but exposing only one-coach-at-a-time UX in v1.
- Decide whether coaches will ever have assistants/staff. If yes or plausibly soon, adopt workspace memberships before Phases 4–6; if no, retain the simpler `coach_id = coach auth user ID` model for v1.
- Name the initial platform administrator(s) and choose the bootstrap/revocation mechanism. Recommend a private `platform_admins` table managed only by trusted server/SQL operations, with audited changes.
- Decide whether Phase 4 needs aggregate Ads reporting only or also identifiable Meta Lead Ads ingestion. Recommend aggregate reporting first; ingestion is Phase 4B.

### Exit criteria

- Schema/authorization and account lifecycle are documented, coach/client/platform-admin access is tested, migrations are reviewed against two-coach fixtures, external account applications are underway, and no unresolved naming or tenancy ambiguity remains.

## Phase 4 — Meta Ads performance and CRM attribution

### Goal

Replace the mock Ad performance page with authenticated, cached Meta campaign reporting, then optionally ingest identifiable Lead Ads submissions into the canonical CRM.

### Deliverables — Phase 4A, required

- Coach-only “Connect Meta” flow with OAuth state validation, callback handling, connection status, account selection, reconnect, and disconnect.
- Server-only credential handling. Never expose app secrets or access tokens to the browser. Store connection metadata and encrypted token material in a private/restricted database location accessible only through trusted server code; record expiry and last validation time.
- Select and persist the coach's Meta business/ad account IDs rather than assuming the first returned account.
- Server-side Marketing API client with explicit API versioning, timeouts, pagination, rate-limit/error handling, token-expiry handling, and errors routed into the existing observability path.
- Incremental sync job for campaign hierarchy and daily insights. Cache normalized daily rows in Supabase; dashboard reads the cache rather than calling Meta on each page load.
- Ad dashboard based on the demo UX, with date range, account/campaign filters, spend, impressions, reach if desired, clicks, CTR, CPC, and Meta-reported lead/conversion counts. Show currency, account timezone, last successful sync, stale-data state, and partial-sync errors.
- Manual refresh with throttling plus a scheduled production sync. Make jobs idempotent and keep a `sync_runs` audit record.
- Disconnect behavior that stops future syncs and removes or revokes credentials while preserving historical metrics according to the documented retention policy.
- Tests for OAuth/state handling, tenant isolation, metric normalization, pagination, expired tokens, rate limiting, duplicate syncs, and no-data states.

### Deliverables — Phase 4B, optional Lead Ads ingestion

- Only if the owner explicitly wants individual form submissions: ingest Meta Lead Ads payloads/webhooks, persist the external lead/form IDs, and idempotently upsert a canonical CRM lead with `stage = new` and Meta source/attribution metadata.
- Preserve raw payloads only as long as needed for debugging/compliance, with documented retention and deletion behavior.
- Provide field mapping and deduplication rules. Default dedupe order: external lead ID, then normalized email, then normalized phone; never merge ambiguous people silently.
- Make clear in the UI that aggregate “leads” reported by Ads Insights may not equal imported CRM contacts because attribution windows, form types, privacy restrictions, and deduplication differ.

### Infrastructure/accounts

- Meta developer app, business portfolio/ad account access, OAuth redirect URLs, app secret, required permissions, production app review/access, and business verification as applicable.
- Vercel scheduled job or another authenticated scheduler. The schedule endpoint must reject arbitrary public invocation.
- A reviewed secret-encryption approach and rotation/revocation runbook.

### Dependencies

- Phase 3 decisions and Meta account setup. Phase 4A does not depend on courses or community.

### Decisions required before start

- 4A only versus 4A + 4B.
- Initial reporting grain: recommend daily campaign-level rows for v1, adding ad-set/ad-level drill-down only if needed.
- Data retention period and supported attribution window.
- Expected sync freshness; recommend periodic background sync plus manual refresh rather than “live” API reads.

### Exit criteria

- A coach can connect one Meta account, select an ad account, see cached real metrics for a chosen date range, diagnose stale/failed syncs, reconnect/disconnect safely, and cannot access another coach's connection or data.

## Phase 5 — Courses and Bunny video delivery

### Goal

Ship a real coach-authored classroom with secure video delivery and durable client progress.

### Deliverables

- Coach course management: draft/publish/archive courses; create, reorder, edit, and delete modules and lessons; preview the client experience.
- Bunny upload workflow through trusted server endpoints: create video record, upload, track processing state, handle failures/retries, and store Bunny identifiers and duration/thumbnail metadata. Keep Bunny API keys server-only.
- Protected playback appropriate to Bunny's supported security model; do not expose unrestricted source URLs.
- Client course grid and lesson player adapted from the demo, showing enrollment eligibility, module structure, completion state, previous/next navigation, and unavailable/processing video states.
- Enrollment management linked to coach/client membership. Manual enrollment is sufficient for v1; leave a clean seam for later automatic enrollment from Stripe products.
- Durable progress with a unique enrollment/lesson record, completion timestamp, last position, and percentage. Throttle/checkpoint position writes; make completion updates idempotent.
- Coach progress view by course and client, including never-started/in-progress/completed states.
- Accessibility basics: captions/transcripts when supplied, keyboard-operable player controls, semantic lesson navigation, and useful focus states.
- RLS and integration tests covering drafts, unenrolled clients, cross-coach access, authoring order, upload failures, and progress resume.

### Infrastructure/accounts

- Bunny Stream production library, API key, allowed/referrer domains or token-auth configuration, webhook/processing strategy if used, and cost/retention settings.

### Dependencies

- Phase 3. Independent of Phase 4 functionality, though it follows Phase 4 in delivery priority.

### Decisions required before start

- Confirm Bunny Stream and playback protection level.
- Maximum upload size/formats, captions/transcript requirement, download policy, and whether external YouTube/Vimeo lessons are supported.
- Manual enrollment only or Stripe-product-to-course mapping in v1. Recommend manual first.

### Exit criteria

- A coach can publish a video course and enroll a client; the client can securely watch, resume, and complete lessons; the coach can see accurate progress; unauthorized tenants and unenrolled users are denied server-side.

## Phase 6 — Client portal and community v1

### Goal

Turn the demo's student experience into an authenticated, persistent client portal centered on courses, community, people, and events.

### Deliverables

- Client portal shell/home with enrolled courses, progress, announcements, and upcoming events; adapt the demo visual hierarchy to the production design system.
- Community feed with categories, posts, comments, reactions/likes, pagination, empty/loading/error states, and optimistic actions where safe.
- Coach announcements with pin/unpin and publish/unpublish controls.
- Member directory and profiles limited to the same coach community. Add privacy controls for fields that clients may hide.
- Leaderboard only if its scoring rule is explicitly defined and explainable; otherwise omit it from v1 rather than using vanity/mock numbers.
- Community calendar using the real calendar domain where possible. Add audience/visibility and event-type fields rather than creating an unrelated duplicate event system.
- Coach moderation: delete/hide content, lock comments if needed, and record who moderated what. Basic coach-only moderation is enough for the chosen single-coach product scope.
- Poll/refetch-based freshness for v1. Structure data access so Supabase Broadcast/Realtime can be added without changing the domain model.
- Authorization, pagination, abuse-input, cross-tenant, deleted-content, and concurrent-reaction tests.

### Infrastructure/accounts

- No new vendor required for v1. Supabase Storage may be needed if post/profile images are in scope; configure bucket policies before enabling uploads.

### Dependencies

- Phase 3 memberships; Phase 5 for course widgets/progress. Reuse the shipped calendar rather than block on notification delivery.

### Decisions required before start

- Whether posts support text only or images/files. Recommend text plus one image type for v1, or text-only if speed matters.
- Member-profile visibility defaults and moderation/retention policy.
- Leaderboard scoring and whether gamification is genuinely desired.

### Exit criteria

- Invited clients see only their coach's portal, can participate in a persistent feed, discover permitted members/events, and access enrolled courses; coaches can announce and moderate; no demo mock state remains in production routes.

## Phase 7 — Background notifications and email

### Goal

Make reminders and important portal activity reliable when the app tab is closed.

### Deliverables

- Provider abstraction and Resend integration for transactional email, separate from the unrelated marketing-site contact form.
- Notification preference model by channel and event type, with required transactional messages distinguished from optional engagement messages.
- Durable outbox/job model with scheduled delivery, idempotency keys, retry/backoff, terminal failure state, and delivery audit trail.
- Calendar reminders that work without an open tab, respecting user timezone and event changes/cancellations.
- Initial templates: client invitation, enrollment, upcoming event/reminder, announcement, and relevant community reply/mention if mentions are in scope.
- Unsubscribe/preference-management links, suppression handling, verified sender domain, and no sensitive content in email by default.
- Admin/coach visibility into failed deliveries integrated with existing error logging.
- Keep browser push out of v1 unless specifically required; email plus in-app notification center is the recommended first release.

### Infrastructure/accounts

- Transactional email account/API key, verified sending domain, DNS records, scheduler, and production callback/webhook configuration if delivery events are tracked.

### Dependencies

- Phase 3 notification schema; Phases 5–6 provide course/community event sources. Calendar reminders can be implemented earlier as an isolated slice if needed.

### Decisions required before start

- Email provider (Resend recommended for consistency), sender identity/domain, notification defaults, reminder timing, and whether browser push is required.

### Exit criteria

- Scheduled reminders deliver with the app closed, duplicates are prevented, preferences are honored, failures are inspectable/retriable, and cross-tenant data never appears in templates.

## Phase 8 — Production hardening and demo retirement

### Goal

Validate the combined CRM, ads, courses, community, and notification product for production use and remove ambiguity between demo and real features.

### Deliverables

- End-to-end journeys for coach signup/setup, client invitation, lead progression, Meta connection/sync, course publish/enrollment/completion, community participation/moderation, calendar reminders, and account disconnect/deletion.
- Automated RLS/security matrix covering every new table and both roles, including cross-coach attack cases and service-role-only paths.
- Review secrets, OAuth callbacks, webhook signatures, scheduler authentication, upload limits, rate limits, input sanitization, CSRF/state protection, audit events, and data deletion/export behavior.
- Performance/load checks for feed pagination, course progress writes, dashboard aggregations, and scheduled sync fan-out. Add indexes based on measured query plans.
- Operational dashboards/runbooks for failed Meta syncs, expiring/revoked connections, Bunny processing failures, email bounces, job backlog, and error-log triage.
- Accessibility and responsive review against the production design system.
- Backups/restore drill and migration rollback notes before production migrations.
- Remove or clearly quarantine `/community-demo`; preserve screenshots/design notes if valuable, but ensure users cannot confuse it with production.
- Update README, environment-variable template, setup documentation, vendor/account prerequisites, and release checklist.

### Infrastructure/accounts

- Production credentials and domains for Meta, Bunny, email, Supabase, Stripe, and Vercel; staging equivalents for release rehearsal.

### Dependencies

- All selected earlier phases.

### Decisions required before start

- Launch cohort, support owner, retention/deletion policy, service-level expectations, and which deferred features are explicitly excluded from launch.

### Exit criteria

- All critical journeys pass in staging and production smoke tests; tenant isolation and recovery procedures are demonstrated; operational owners can diagnose vendor failures; the static demo is no longer mistaken for the product.

## Cross-phase execution rules

- Each phase ships as its own reviewed migration(s) plus application changes; never bundle all schema changes into one irreversible release.
- Every new fetch/mutation must use the app's existing visible-error and `error_logs` conventions.
- Every new table needs explicit RLS, appropriate indexes, and positive/negative tenant tests before its UI is considered complete.
- Service-role access is restricted to server-only jobs/routes and must still scope every operation to an explicit coach; service role is not a substitute for tenancy checks.
- External API calls must be versioned, timeout-bounded, retry-aware, observable, and decoupled from ordinary page rendering through cached data or durable jobs.
- Use the mockup for layout and interaction guidance, but rebuild against production domain services and shared design tokens. Do not import its mock data or in-memory state into real routes.
- Finish each phase with migrations applied in staging, automated checks passing, manual acceptance against coach and client accounts, documentation updated, and a clear rollback/disable path.

## Explicitly deferred backlog

- Custom domains and full per-coach white-label branding.
- Platform-wide multi-coach discovery or moderation staff roles.
- Native livestream hosting; v1 events may link to Zoom/Google Meet.
- Real-time presence/chat and browser/mobile push.
- Automated Stripe-product-to-course entitlements unless selected in Phase 5.
- Ad creation/editing from CoachOS; Phase 4 is read/report/sync only.
- Advanced cross-channel attribution, offline conversions, and automated ad optimization.
