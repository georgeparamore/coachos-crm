# `/community-demo` screen inventory

Every screen in the static concept mockup (`src/app/community-demo/`), mapped to what happens
to it in the real build. Per the accepted defaults, the mockup is a **UX/interaction
reference only** — no mock data, in-memory state, or component is imported into production
routes as-is. "Adapt" below means: rebuild against real Supabase data, RLS, and the shared
design system, reusing the mockup's layout/interaction decisions.

| Mockup screen | Disposition | Real-build target |
|---|---|---|
| `/community-demo` (student home: progress, continue-watching, today's calendar, community highlights, new members) | **Adapt** | Phase 6 — becomes the client portal home (`/community-demo`'s layout is a reasonable starting point for a new authenticated client-facing shell; doesn't exist as a real route yet) |
| `/community-demo/classroom` (course grid) | **Adapt** | Phase 5 — real client course grid, enrollment-gated |
| `/community-demo/classroom/[courseId]` (video lesson player, mark-complete) | **Adapt** | Phase 5 — real lesson player over Bunny Stream, durable `lesson_progress` |
| `/community-demo/community` (post feed, categories, likes, comments, leaderboard) | **Adapt, minus leaderboard** | Phase 6 — real community feed. Leaderboard is explicitly **omitted** per the plan ("only if its scoring rule is explicitly defined... otherwise omit") — the mockup's points are vanity mock numbers with no real scoring rule defined yet |
| `/community-demo/members` (directory + profile modal) | **Adapt** | Phase 6 — member directory scoped to the same coach's active `coach_client_memberships`, with privacy controls for hideable fields |
| `/community-demo/calendar` (student calendar view) | **Retire mockup, use real calendar** | Phase 6 — the app already has a real, Supabase-backed calendar (`/calendar`, `0004_calendar.sql`). Extend it with audience/visibility + event-type fields rather than building a second event system |
| `/community-demo/admin` (overview: recent leads, today's schedule, stats, chart, lead sources, community activity) | **Retire mockup, enhance real screens** | The real app already has `/dashboard` and `/crm` covering most of this (leads, stats). Rather than a new route, extend the real `/dashboard` with a "today's schedule" card (calendar already has the data) and a community-activity card (once Phase 6 ships) |
| `/community-demo/admin/courses` (course authoring, paste-a-YouTube-link) | **Adapt, replace video source** | Phase 5 — real coach course/module/lesson authoring, YouTube-link input replaced by the Bunny Stream upload workflow |
| `/community-demo/admin/live` (schedule Google Meet/Zoom/"native" streams) | **Adapt, drop "native"** | Folds into the real calendar's event model (Phase 6) as a platform + join-link field on events. "Native" in-app livestreaming is explicitly on the deferred backlog — Google Meet/Zoom links only |
| `/community-demo/admin/students` (progress table) | **Adapt** | Phase 5 — real coach-facing progress view by course/client (never-started/in-progress/completed) |
| `/community-demo/admin/leads` (4-stage pipeline table + Email compose action) | **Retire pipeline UI, real CRM already exists; port the Email action** | The real `/crm` already has full lead CRUD on the canonical 4-stage enum (`new`/`in_conversation`/`proposal_sent`/`signed` — see architecture-decisions.md). The mockup's simplified stage *labels* don't carry over (display-mapping only, if wanted). The one genuinely new idea here — a one-click "Email this lead" compose modal — doesn't exist in the real CRM yet and is worth adding as a small real feature, independent of any phase below (small, low-risk, no new schema) |
| `/community-demo/admin/ads` (Facebook Ads connect-gate + mock campaign dashboard) | **Retire mockup, replace with real integration** | Phase 4 — real Meta OAuth connection + cached campaign/spend/lead data, using `0011_meta_ads.sql` |
| `/community-demo/admin/calendar` (editable admin calendar) | **Retire mockup, use real calendar** | Same as the student calendar row — the real `/calendar` already supports create/edit/delete; just needs the audience/visibility fields from Phase 6 |
| Daily welcome popup (time-of-day greeting + rotating encouraging message + today's counts) | **Optional nice-to-have, not phase-critical** | Not part of Phases 3–8. If wanted later, it's a small, low-risk addition to the real `/dashboard` (name from `profiles.full_name`, counts from real `leads`/`events` queries) — no new schema needed. Not scheduled; call it out explicitly if you want it slotted in |
| Light-mode-by-default fix, icon-sizing CSS fixes | **Already global, not mockup-specific** | These landed in `src/app/layout.tsx` / `globals.css`, which the real app already uses — no further action |

## What gets deleted at Phase 8

Per the plan's Phase 8 deliverables ("Remove or clearly quarantine `/community-demo`"), once
the real equivalents above have shipped:

- `src/app/community-demo/` (entire route tree — student site + admin panel)
- `src/components/community-demo/` (entire component tree)
- `src/lib/community-demo-data.ts`, `src/lib/community-demo-store.tsx`
- The `/community-demo` public-path exception in `src/lib/supabase/middleware.ts`

Until Phase 8, the mockup stays in the repo and stays public/unauthenticated — it's still
useful as a living reference and a thing you can point stakeholders at while the real
features are mid-build.
