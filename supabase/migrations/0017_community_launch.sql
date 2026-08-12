-- DJS CRM Community launch hardening.
-- Expose only the minimal member directory fields through a guarded RPC and
-- allow coaches to react inside the communities they own.

create or replace function public.community_member_directory(target_coach_id uuid)
returns table (
  id uuid,
  full_name text,
  role text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.role
  from public.profiles p
  where (
    target_coach_id = auth.uid()
    or exists (
      select 1
      from public.coach_client_memberships viewer_membership
      where viewer_membership.coach_id = target_coach_id
        and viewer_membership.client_id = auth.uid()
        and viewer_membership.status = 'active'
    )
  )
  and (
    p.id = target_coach_id
    or exists (
      select 1
      from public.coach_client_memberships member
      where member.coach_id = target_coach_id
        and member.client_id = p.id
        and member.status = 'active'
    )
  )
  order by (p.id = target_coach_id) desc, p.full_name nulls last;
$$;

revoke all on function public.community_member_directory(uuid) from public, anon;
grant execute on function public.community_member_directory(uuid) to authenticated;

create policy "community_reactions: coach can react in own community"
  on public.community_reactions for insert
  with check (
    author_id = auth.uid()
    and (
      (post_id is not null and exists (
        select 1 from public.community_posts p
        where p.id = community_reactions.post_id
          and p.coach_id = auth.uid()
          and p.moderation_status = 'visible'
          and p.deleted_at is null
      ))
      or
      (comment_id is not null and exists (
        select 1
        from public.community_comments c
        join public.community_posts p on p.id = c.post_id
        where c.id = community_reactions.comment_id
          and p.coach_id = auth.uid()
          and p.moderation_status = 'visible'
          and p.deleted_at is null
          and c.moderation_status = 'visible'
          and c.deleted_at is null
      ))
    )
  );
