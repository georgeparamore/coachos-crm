<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project identity and source of truth

- **DJS CRM** is the active product name. Not "CoachOS" — that was a placeholder, already
  renamed everywhere in the live app (sidebar, login/signup, page titles, error screens).
- **`/community-demo` (and `/community-demo/admin`) is the approved visual/UX source of
  truth** for how the real product should look and be laid out — its cards, nav grouping,
  spacing, and page structure. It is **not** itself the product: it's a static,
  unauthenticated, in-memory mockup with zero database behind it (confirmed — no Supabase
  usage anywhere in `src/app/community-demo/` or `src/components/community-demo/`; nothing
  typed into it persists past a page refresh). Real pages must be built under the
  authenticated `(app)` route group, reading/writing the real Supabase tables, styled to
  match the mockup's look.
- **The old `/dashboard`'s legacy billing-heavy nav is deprecated from the primary
  experience.** Analytics, Deal evaluations, Subscriptions, Invoices, and Contracts are real,
  working, Stripe-connected Phase 1-2 features — they still exist and still work, but are
  intentionally hidden from the sidebar (see the comment in `src/components/nav-config.ts`)
  while the DJS CRM direction is being built out. **Do not add them back to the nav, and do
  not add new billing/subscription/contract features, without explicit approval from
  George.** Re-add them once the rest of the product is finished (there's a standing
  reminder task for this).
- Do not import `/community-demo`'s mock components or in-memory store into real, database-
  backed pages. Rebuild against real Supabase data, RLS, and the shared design system
  (`globals.css`), reusing the mockup's layout/interaction decisions — same pattern already
  used for the real Courses, Ad performance, and Dashboard pages.
- Before making structural changes (nav, page layout, what's "real" vs "legacy"), check
  `git status`, recent commit history, and `docs/community-demo-inventory.md` /
  `docs/architecture-decisions.md` — they record what's already been decided.
- When it's unclear whether something should follow the new DJS CRM direction or the old
  build's behavior, stop and ask George rather than guessing from the legacy build.
