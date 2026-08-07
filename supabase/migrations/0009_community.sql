-- CoachOS Phase 6: community feed (posts, comments, reactions, categories).
-- Run via `supabase db push` or paste into the Supabase SQL editor, against a
-- STAGING project first — see docs/architecture-decisions.md before applying
-- to production. Depends on 0001_init.sql and 0007_memberships.sql
-- (client visibility is membership-gated, not enrollment-gated — being in a
-- coach's community is broader than being enrolled in any specific course).
--
-- Per docs/architecture-decisions.md, "announcements" and "moderation state"
-- are folded into community_posts as flags rather than separate tables, to
-- keep v1 lean. No leaderboard/points table — the plan explicitly omits
-- gamification from v1 pending a real scoring rule.

-- ---------------------------------------------------------------------------
-- community_categories
-- ---------------------------------------------------------------------------
create table if not exists public.community_categories (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_categories_coach_id_idx on public.community_categories (coach_id);

alter table public.community_categories enable row level security;

create policy "community_categories: coach full access to own rows"
  on public.community_categories for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "community_categories: members can view"
  on public.community_categories for select
  using (
    exists (
      select 1 from public.coach_client_memberships m
      where m.coach_id = community_categories.coach_id and m.client_id = auth.uid() and m.status = 'active'
    )
  );

drop trigger if exists community_categories_set_updated_at on public.community_categories;
create trigger community_categories_set_updated_at
  before update on public.community_categories
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
create type public.post_moderation_status as enum (
  'visible',
  'hidden'
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.community_categories (id) on delete set null,
  content text not null,
  is_announcement boolean not null default false,
  is_pinned boolean not null default false,
  moderation_status public.post_moderation_status not null default 'visible',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_coach_id_idx on public.community_posts (coach_id);
create index if not exists community_posts_author_id_idx on public.community_posts (author_id);
create index if not exists community_posts_category_id_idx on public.community_posts (category_id);
create index if not exists community_posts_created_at_idx on public.community_posts (coach_id, created_at desc);

alter table public.community_posts enable row level security;

-- Only a coach author (author_id = coach_id = auth.uid(), enforced by the
-- trigger below) may set is_announcement/is_pinned/moderation_status — a
-- client posting in their coach's community can't self-announce or
-- self-moderate. This is enforced by trigger, not just RLS, because RLS
-- can't restrict individual columns on its own.
create or replace function public.community_posts_guard_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() <> new.coach_id then
    -- Not the coach: force privileged fields back to safe values regardless
    -- of what the client sent.
    new.is_announcement := false;
    new.is_pinned := false;
    new.moderation_status := 'visible';
    new.moderated_by := null;
    new.moderated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists community_posts_guard_privileged_fields on public.community_posts;
create trigger community_posts_guard_privileged_fields
  before insert or update on public.community_posts
  for each row execute procedure public.community_posts_guard_privileged_fields();

create policy "community_posts: coach full access to own community"
  on public.community_posts for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create policy "community_posts: members can view visible posts"
  on public.community_posts for select
  using (
    moderation_status = 'visible'
    and deleted_at is null
    and exists (
      select 1 from public.coach_client_memberships m
      where m.coach_id = community_posts.coach_id and m.client_id = auth.uid() and m.status = 'active'
    )
  );

create policy "community_posts: members can create own posts"
  on public.community_posts for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.coach_client_memberships m
      where m.coach_id = community_posts.coach_id and m.client_id = auth.uid() and m.status = 'active'
    )
  );

create policy "community_posts: members can edit or soft-delete own posts"
  on public.community_posts for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- community_comments
-- ---------------------------------------------------------------------------
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  moderation_status public.post_moderation_status not null default 'visible',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_comments_post_id_idx on public.community_comments (post_id);
create index if not exists community_comments_author_id_idx on public.community_comments (author_id);

alter table public.community_comments enable row level security;

create policy "community_comments: coach can moderate own comments"
  on public.community_comments for all
  using (exists (select 1 from public.community_posts p where p.id = community_comments.post_id and p.coach_id = auth.uid()))
  with check (exists (select 1 from public.community_posts p where p.id = community_comments.post_id and p.coach_id = auth.uid()));

create policy "community_comments: members can view comments on visible posts"
  on public.community_comments for select
  using (
    moderation_status = 'visible'
    and deleted_at is null
    and exists (
      select 1 from public.community_posts p
      join public.coach_client_memberships m on m.coach_id = p.coach_id
      where p.id = community_comments.post_id
        and p.moderation_status = 'visible'
        and m.client_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "community_comments: members can comment on visible posts"
  on public.community_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      join public.coach_client_memberships m on m.coach_id = p.coach_id
      where p.id = community_comments.post_id
        and p.moderation_status = 'visible'
        and m.client_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "community_comments: members can edit own comments"
  on public.community_comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop trigger if exists community_comments_set_updated_at on public.community_comments;
create trigger community_comments_set_updated_at
  before update on public.community_comments
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- community_reactions: a single reaction table for both posts and comments.
-- Exactly one of post_id/comment_id is set.
-- ---------------------------------------------------------------------------
create table if not exists public.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  constraint community_reactions_target_check check (
    (post_id is not null and comment_id is null) or (post_id is null and comment_id is not null)
  )
);

create unique index if not exists community_reactions_post_author_uniq
  on public.community_reactions (post_id, author_id, reaction_type) where post_id is not null;
create unique index if not exists community_reactions_comment_author_uniq
  on public.community_reactions (comment_id, author_id, reaction_type) where comment_id is not null;
create index if not exists community_reactions_post_id_idx on public.community_reactions (post_id);
create index if not exists community_reactions_comment_id_idx on public.community_reactions (comment_id);

alter table public.community_reactions enable row level security;

create policy "community_reactions: members can view visible reactions"
  on public.community_reactions for select
  using (
    (
      post_id is not null and exists (
        select 1 from public.community_posts p
        join public.coach_client_memberships m on m.coach_id = p.coach_id
        where p.id = community_reactions.post_id and m.client_id = auth.uid() and m.status = 'active'
      )
    )
    or (
      comment_id is not null and exists (
        select 1 from public.community_comments c
        join public.community_posts p on p.id = c.post_id
        join public.coach_client_memberships m on m.coach_id = p.coach_id
        where c.id = community_reactions.comment_id and m.client_id = auth.uid() and m.status = 'active'
      )
    )
    or exists (
      -- coach can always see reactions in their own community
      select 1 from public.community_posts p where p.id = community_reactions.post_id and p.coach_id = auth.uid()
    )
  );

create policy "community_reactions: members can react to visible content"
  on public.community_reactions for insert
  with check (
    author_id = auth.uid()
    and (
      (
        post_id is not null and exists (
          select 1 from public.community_posts p
          join public.coach_client_memberships m on m.coach_id = p.coach_id
          where p.id = community_reactions.post_id and p.moderation_status = 'visible' and m.client_id = auth.uid() and m.status = 'active'
        )
      )
      or (
        comment_id is not null and exists (
          select 1 from public.community_comments c
          join public.community_posts p on p.id = c.post_id
          join public.coach_client_memberships m on m.coach_id = p.coach_id
          where c.id = community_reactions.comment_id and c.moderation_status = 'visible' and m.client_id = auth.uid() and m.status = 'active'
        )
      )
    )
  );

create policy "community_reactions: authors can remove own reaction"
  on public.community_reactions for delete
  using (author_id = auth.uid());
