-- DJS CRM: one explicit next-action date per open lead. Overdue/due states
-- are derived from this timestamp so there is no status column to drift.

alter table public.leads
  add column if not exists follow_up_at timestamptz;

create index if not exists leads_coach_follow_up_idx
  on public.leads (coach_id, follow_up_at)
  where follow_up_at is not null and stage <> 'signed';
