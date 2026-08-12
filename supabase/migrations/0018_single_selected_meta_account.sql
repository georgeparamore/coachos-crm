-- A Meta connection can sync exactly one selected ad account at a time.
-- Selection changes already clear other rows first; this constraint keeps
-- reconnects or concurrent requests from ever creating an ambiguous state.
create unique index if not exists meta_ad_accounts_one_selected_per_connection
  on public.meta_ad_accounts (connection_id)
  where is_selected;
