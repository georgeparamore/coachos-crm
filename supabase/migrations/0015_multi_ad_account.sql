-- DJS CRM: support syncing more than one ad account at once per connection
-- (e.g. a coach running ads for two separate businesses under one Meta
-- login). Previously meta_ad_accounts.is_selected was treated as exclusive
-- (the sync job and UI both assumed exactly one selected row per
-- connection) — this migration doesn't change that column's meaning, just
-- what reads it: the app code now treats "is_selected = true" as "included
-- in sync," not "the one account," and rows can be selected independently.
--
-- label: an optional coach-chosen name (e.g. "Coaching business" vs
-- "Other business") shown instead of/alongside Meta's own account name,
-- since Meta account names are often unhelpful defaults.
alter table public.meta_ad_accounts add column if not exists label text;

-- ad_account_id: which selected account a campaign belongs to. Meta
-- campaign IDs are globally unique so this was never needed for
-- correctness (no collision risk), only for grouping/labeling the Ad
-- performance page by account now that more than one can be synced at
-- once. Nullable + backfill-free: existing rows just show ungrouped until
-- the next sync repopulates it.
alter table public.meta_campaigns add column if not exists ad_account_id uuid references public.meta_ad_accounts (id) on delete set null;

create index if not exists meta_campaigns_ad_account_id_idx on public.meta_campaigns (ad_account_id);
