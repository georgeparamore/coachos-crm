# CoachOS

Full-stack coaching/consulting platform combining CRM (leads, pipeline, proposals),
billing (subscriptions, invoices, contracts), courses, and community — built for a
solo coach to run their business from one place.

This repo is the real build. The visual/interaction design is a direct port of the
original clickable HTML demo (`coachos-platform.html`, kept as design reference) —
same tokens, same layout, same components.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database & auth | Supabase |
| Payments & subscriptions | Stripe (Phase 2) |
| Ad performance | Meta Marketing API (Phase 4) |
| Video hosting & streaming | Bunny Stream (Phase 5) |
| Email/notifications | Resend (Phase 7) |
| App hosting | Vercel or Railway |

## Phase 1 — Foundation

- [x] Supabase project schema: `profiles` (coach/client roles) + `leads` (CRM pipeline), with RLS
- [x] Next.js App Router structure, design system ported from the HTML reference
- [x] Auth: coach login/signup + client login, role-checked against `profiles.role`
- [x] CRM: real lead CRUD (add / edit / change stage / delete) wired to Supabase, kanban by stage
- [x] Dashboard: active clients & open leads pulled live from Supabase

## Phase 2 — Monetization (this build)

- [x] Stripe subscriptions: generate a Checkout link for a client/plan, webhook syncs status
- [x] Invoices: one-time Stripe invoices, generated + sent from the Invoices page, webhook marks paid
- [x] Contracts: editable templates (seeded per coach), send a signable link, public `/sign/[token]`
      page for the client, status tracked draft → sent → viewed → signed, with an audit trail
      (signer IP, user agent, viewed timestamp, and a SHA-256 hash of the exact text signed —
      not identity verification or a DocuSign-grade certificate, just a defensible record)
- [ ] Courses & community are still stubbed with the ported UI and a "Phase N" notice

## Calendar (added post-Phase-2)

- [x] `/calendar`: month view + a day agenda, create/edit/delete events, optionally linked to a lead
- [x] Dashboard shows today's date in the greeting and a "Today's schedule" card
- [x] In-tab reminders via the browser Notification API — fires while the dashboard/calendar tab is
      open, does **not** work if the tab/browser is closed (that needs a background job + push
      subscription — see Phase 7 below)

## Roadmap (Phases 3–8)

Everything past Phase 2 follows a phased plan drafted after a `/community-demo` concept
mockup (a static, unauthenticated UX exploration — see `docs/community-demo-inventory.md`
for what in it is real-build reference vs. throwaway) surfaced the shape of courses,
community, and a new Meta (Facebook/Instagram) Ads integration requirement. The full plan
lives at `docs/phased-build-plan.md`; the product/technical decisions it locks in (and why)
are recorded in `docs/architecture-decisions.md`. Short version: **Phase 4 (Meta Ads) ships
before Phase 5 (Courses)** since it's the new business driver and has external approval lead
time, then Phase 6 (Community), Phase 7 (background notifications/email), Phase 8 (hardening +
retiring the mockup).

### Phase 3 — Product foundation and schema contracts

- [x] Decisions locked and documented: `docs/architecture-decisions.md`
- [x] `/community-demo` screens inventoried and mapped to real routes/later phases/retire:
      `docs/community-demo-inventory.md`
- [x] Migrations designed for coach/client memberships, platform admins, courses, community,
      notifications, and Meta Ads — written and verified to apply cleanly against a local
      Postgres instance, **not yet applied to any real Supabase project**:
      `0007_memberships.sql`, `0008_courses.sql`, `0009_community.sql`,
      `0010_notifications.sql`, `0011_meta_ads.sql`
- [ ] Feature-flag/config strategy so Meta/Bunny/community/notifications can be toggled per
      environment
- [ ] `ADMIN_EMAIL` env-var check migrated to the new `platform_admins` table (table exists;
      call sites — currently gating `/admin/errors` — not yet updated)
- [ ] Two-coach RLS acceptance fixtures exercised against a real Supabase project (needs real
      auth sessions to test meaningfully; a local Postgres stub can prove the schema applies
      but not that the policies hold up under real JWTs)

### Phase 4 — Meta Ads performance and CRM attribution

- [x] "Connect Meta" OAuth flow: `/api/meta/connect` (coach-only, signed CSRF state) →
      Meta's OAuth dialog → `/api/meta/callback` (exchanges code for a long-lived token,
      encrypts it at the application layer on top of `meta_connections`' service-role-only
      RLS, fetches + stores the coach's ad accounts)
  - Note: `ads_read` currently requested, per the account discovery approach in
    `src/lib/meta/client.ts` — `business_management` may need adding if ad-account discovery
    comes back empty for an account only reachable via a Business Manager the coach doesn't
    personally admin. First thing to check once real credentials are in.
- [x] `/api/meta/disconnect`: best-effort revokes the token with Meta, then always clears the
      local copy and marks the connection disconnected (never trust the remote revoke call
      alone)
- [x] Settings page shows real connection status (`src/components/meta-connection-row.tsx`) —
      Connect/Disconnect buttons, connected ad account name, inline success/error banners
- [x] Versioned Marketing API client (`src/lib/meta/client.ts`): token exchange, ad accounts,
      campaigns, daily insights — timeout-bounded, one retry on 429/5xx, paginated
- [ ] **Not yet tested against real Meta data** — no live app/credentials existed while this
      was written. First real-data checks needed: does `ads_read` alone surface the right ad
      accounts; is the `actions` → lead-count mapping in `fetchDailyInsights` correct for this
      account's campaign types (see the comment in that function)
- [ ] Sync job (incremental campaign/insight caching into `meta_campaigns` /
      `meta_ad_insights_daily`, so the dashboard reads cache instead of calling Meta live) —
      not built yet
- [ ] Ad performance dashboard UI reading the cached tables — not built yet (the
      `/community-demo/admin/ads` mockup is the UX reference, per
      `docs/community-demo-inventory.md`)
- [ ] Ad-account picker UI for coaches with more than one ad account (auto-selected today only
      when there's exactly one)
- [ ] Scheduled production sync (Vercel Cron or equivalent) — deliberately deferred until the
      connect flow itself is verified working end-to-end

## Demo login

To let visitors try CoachOS without creating an account, add a "Try the demo" button to `/login`:

1. Sign up a real coach account at `/signup` for the demo (a normal account, nothing special about it).
2. Copy its `id` from Supabase: Table Editor → `profiles` → the row with that email.
3. Run `supabase/seed-demo.sql` in the SQL Editor with that id swapped in — it fills the account with
   sample leads and calendar events.
4. Set `NEXT_PUBLIC_DEMO_EMAIL` / `NEXT_PUBLIC_DEMO_PASSWORD` (in `.env.local` and in Vercel) to that
   account's credentials. The button only renders when both are set.

This is a **shared, real, writable account** — anyone who clicks the button can add/edit/delete its
data, and a banner says so while browsing it. There's no reset mechanism yet; if the demo data gets
messy, just re-run `seed-demo.sql` (after clearing the account's existing rows) or rotate to a fresh
account and update the env vars.

## Error handling & the feedback loop

- Every data fetch and mutation across the app is wrapped: server-side query failures show a plain
  "couldn't load X" notice instead of silently rendering an empty list, and client-side mutation
  failures (save/delete/etc.) show the real reason inline **and** as a dismissable corner toast.
- Every reported error is also logged to a Supabase `error_logs` table (migration `0006`), with a
  short reference id shown in the toast so a user can quote it if they reach out.
- Unhandled crashes get a friendly fallback screen (via Next's `error.tsx` boundaries) instead of a
  blank page or a stack trace — never the raw Next.js dev error overlay in production.
- Set `ADMIN_EMAIL` to your own coach account's email to get an **Error log** link in the sidebar
  (`/admin/errors`) listing the last 100 reported errors — that's the feedback loop: you don't have
  to wait for someone to tell you something broke.

## Local setup

1. Create a Supabase project.
2. In the SQL editor, run, in order: `supabase/migrations/0001_init.sql`, `0002_monetization.sql`,
   `0003_contract_audit_trail.sql`, `0004_calendar.sql`, `0005_profile_timezone.sql`,
   `0006_error_logs.sql`.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, the **secret** key (server-only, powers the public
     contract-signing endpoint and the Stripe webhook — never expose this client-side)
   - `STRIPE_SECRET_KEY` — Stripe dashboard → Developers → API keys
   - `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROUP` / `STRIPE_PRICE_ELITE` — price IDs from Stripe
     Products (create three products/prices there matching the placeholder plans, or your real ones)
   - `STRIPE_WEBHOOK_SECRET` — see below
   - `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` locally, your real domain in production
4. `npm install`
5. `npm run dev`

Sign up at `/signup` to create your coach account (this creates a `profiles` row with
`role = 'coach'` via a database trigger on `auth.users`, which also seeds three starter
contract templates). Client accounts are created the same way with `role = 'client'` in user
metadata — the coach-invite flow for that lands in a later phase.

### Stripe webhook (local dev)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

That prints a `whsec_...` value — put it in `STRIPE_WEBHOOK_SECRET`. In production, create a
webhook endpoint in the Stripe dashboard pointing at `https://yourdomain.com/api/stripe/webhook`
listening for `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.voided`, and
`invoice.marked_uncollectible` — use the signing secret it gives you.

## Project structure

```
src/app/(app)/          authenticated shell (sidebar) + one folder per screen
src/app/login, /signup  auth pages
src/app/sign/[token]    public contract signing page (no account required)
src/app/api/stripe/     checkout + invoice creation, webhook handler
src/app/api/contracts/  public GET/sign endpoints for a contract, gated by its sign_token
src/components/         shared UI: sidebar, nav config/icons, theme toggle, CRM/billing/contract forms
src/lib/supabase/       browser client, server client, service-role client, middleware session refresh
src/lib/stripe.ts       Stripe SDK instance + placeholder plan → price ID mapping
src/proxy.ts            Next.js 16 request middleware — redirects unauthenticated users to /login
supabase/migrations/    SQL schema + RLS policies
```

## Build order (remaining phases)

**Phase 3 — Courses**
Bunny.net video upload/streaming · course/module/lesson data model · enrollment tied to
subscription plan · per-lesson progress tracking.

**Phase 4 — Community + polish**
Community feed (posts, replies, announcements) · client-facing portal (separate view from
the coach dashboard) · email notifications · custom domain + branding.

## Key decisions still to make

- Platform name (currently "CoachOS" — placeholder)
- Actual plan names, prices, and what's included in each
- Course lineup — titles, modules, which plans get access
- Contract templates — exact language and terms
- What lead sources to track (website form, Instagram, referral, etc.)
