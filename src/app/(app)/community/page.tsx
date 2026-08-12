import { redirect } from "next/navigation";
import { CommunityHub, type CommunityCategory, type CommunityComment, type CommunityMember, type CommunityPost, type CommunityReaction } from "@/components/community-hub";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-server-error";

export default async function CommunityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isCoach = profile?.role !== "client";
  let coachId = user.id;
  if (!isCoach) {
    const { data: membership } = await supabase.from("coach_client_memberships").select("coach_id").eq("client_id", user.id).eq("status", "active").order("accepted_at", { ascending: false }).limit(1).maybeSingle();
    if (!membership) return <div className="page"><div className="card community-empty-state"><h1>Community access pending</h1><p>Accept your coach&apos;s invitation to join their private community.</p></div></div>;
    coachId = membership.coach_id;
  }

  const [categoriesResult, postsResult, membersResult] = await Promise.all([
    supabase.from("community_categories").select("id, name").eq("coach_id", coachId).order("position"),
    supabase.from("community_posts").select("id, author_id, category_id, content, is_announcement, is_pinned, moderation_status, deleted_at, created_at").eq("coach_id", coachId).is("deleted_at", null).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("community_member_directory", { target_coach_id: coachId }),
  ]);
  const posts = (postsResult.data ?? []) as CommunityPost[];
  const postIds = posts.map((post) => post.id);
  const [commentsResult, reactionsResult] = postIds.length > 0 ? await Promise.all([
    supabase.from("community_comments").select("id, post_id, author_id, content, moderation_status, deleted_at, created_at").in("post_id", postIds).order("created_at"),
    supabase.from("community_reactions").select("id, post_id, comment_id, author_id").in("post_id", postIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];

  const errors = [categoriesResult.error, postsResult.error, membersResult.error, commentsResult.error, reactionsResult.error].filter(Boolean);
  if (errors.length > 0) await Promise.all(errors.map((error) => logServerError(error, `community.load.${coachId}`, { userId: user.id, userEmail: user.email })));

  return <div className="page community-page"><CommunityHub categories={(categoriesResult.data ?? []) as CommunityCategory[]} coachId={coachId} comments={(commentsResult.data ?? []) as CommunityComment[]} currentUserId={user.id} isCoach={isCoach} members={(membersResult.data ?? []) as CommunityMember[]} posts={posts} reactions={(reactionsResult.data ?? []) as CommunityReaction[]} /></div>;
}
