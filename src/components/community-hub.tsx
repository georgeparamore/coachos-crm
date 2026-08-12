"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { initialsOf } from "@/lib/format";
import { NavIcon } from "@/components/nav-icon";

export type CommunityMember = { id: string; full_name: string | null; role: "coach" | "client" };
export type CommunityCategory = { id: string; name: string };
export type CommunityComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  moderation_status: "visible" | "hidden";
  deleted_at: string | null;
  created_at: string;
};
export type CommunityReaction = { id: string; post_id: string | null; comment_id: string | null; author_id: string };
export type CommunityPost = {
  id: string;
  author_id: string;
  category_id: string | null;
  content: string;
  is_announcement: boolean;
  is_pinned: boolean;
  moderation_status: "visible" | "hidden";
  deleted_at: string | null;
  created_at: string;
};

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CommunityHub({
  coachId,
  currentUserId,
  isCoach,
  members,
  categories,
  posts,
  comments,
  reactions,
}: {
  coachId: string;
  currentUserId: string;
  isCoach: boolean;
  members: CommunityMember[];
  categories: CommunityCategory[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  reactions: CommunityReaction[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [announcement, setAnnouncement] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const visiblePosts = useMemo(() => posts.filter((post) => {
    if (filter === "announcements") return post.is_announcement;
    if (filter !== "all") return post.category_id === filter;
    return true;
  }), [filter, posts]);

  function refreshAfter(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error.message);
      else router.refresh();
    });
  }

  function submitPost(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    refreshAfter(async () => {
      const result = await createClient().from("community_posts").insert({
        coach_id: coachId,
        author_id: currentUserId,
        category_id: categoryId || null,
        content,
        is_announcement: isCoach && announcement,
        is_pinned: isCoach && announcement,
      });
      if (!result.error) {
        setDraft("");
        setAnnouncement(false);
      }
      return result;
    });
  }

  function submitComment(postId: string) {
    const content = (commentDrafts[postId] ?? "").trim();
    if (!content) return;
    refreshAfter(async () => {
      const result = await createClient().from("community_comments").insert({ post_id: postId, author_id: currentUserId, content });
      if (!result.error) setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      return result;
    });
  }

  function toggleReaction(postId: string) {
    const existing = reactions.find((reaction) => reaction.post_id === postId && reaction.author_id === currentUserId);
    refreshAfter(() => existing
      ? createClient().from("community_reactions").delete().eq("id", existing.id)
      : createClient().from("community_reactions").insert({ post_id: postId, author_id: currentUserId, reaction_type: "like" }));
  }

  function moderate(post: CommunityPost) {
    const nextStatus = post.moderation_status === "visible" ? "hidden" : "visible";
    refreshAfter(() => createClient().from("community_posts").update({
      moderation_status: nextStatus,
      moderated_by: currentUserId,
      moderated_at: new Date().toISOString(),
    }).eq("id", post.id));
  }

  function removeOwnPost(postId: string) {
    refreshAfter(() => createClient().from("community_posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId));
  }

  return (
    <>
      <section className="community-hero">
        <div>
          <div className="eyebrow">Your private space</div>
          <h1>Community</h1>
          <p>Share progress, ask better questions, and keep the conversation moving between sessions.</p>
        </div>
        <div className="community-hero-stat"><strong>{members.length}</strong><span>{members.length === 1 ? "member" : "members"}</span></div>
      </section>

      <div className="community-layout">
        <main>
          <form className="card community-composer" onSubmit={submitPost}>
            <div className="community-composer-top">
              <div className="avatar community-avatar">{initialsOf(memberById.get(currentUserId)?.full_name || "You")}</div>
              <textarea aria-label="Post content" className="rd-input rd-textarea" maxLength={3000} onChange={(event) => setDraft(event.target.value)} placeholder="Share a win, ask a question, or start a conversation…" value={draft} />
            </div>
            <div className="community-composer-footer">
              <div className="community-composer-options">
                {categories.length > 0 && <select aria-label="Post category" className="rd-input" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>}
                {isCoach && <label className="community-check"><input checked={announcement} onChange={(event) => setAnnouncement(event.target.checked)} type="checkbox" /> Announcement</label>}
              </div>
              <button className="btn btn-accent" disabled={!draft.trim() || isPending} type="submit">Publish</button>
            </div>
          </form>

          <div className="community-filters" aria-label="Filter posts">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
            <button className={filter === "announcements" ? "active" : ""} onClick={() => setFilter("announcements")}>Announcements</button>
            {categories.map((category) => <button className={filter === category.id ? "active" : ""} key={category.id} onClick={() => setFilter(category.id)}>{category.name}</button>)}
          </div>

          {error && <div className="community-error" role="alert">{error}</div>}
          <div className="community-feed">
            {visiblePosts.length === 0 ? (
              <div className="card community-empty-state"><span className="community-empty-icon"><NavIcon name="message" /></span><h2>{posts.length === 0 ? "Start the first conversation" : "Nothing in this category yet"}</h2><p>{posts.length === 0 ? "A simple question or quick win is all it takes to get your community moving." : "Choose another category or publish something new."}</p></div>
            ) : visiblePosts.map((post) => {
              const author = memberById.get(post.author_id);
              const postComments = comments.filter((comment) => comment.post_id === post.id && !comment.deleted_at && (isCoach || comment.moderation_status === "visible"));
              const postReactions = reactions.filter((reaction) => reaction.post_id === post.id);
              const liked = postReactions.some((reaction) => reaction.author_id === currentUserId);
              const commentsOpen = openComments[post.id] || false;
              return <article className={`card community-post${post.is_announcement ? " announcement" : ""}${post.moderation_status === "hidden" ? " hidden-post" : ""}`} key={post.id}>
                {(post.is_announcement || post.is_pinned || post.moderation_status === "hidden") && <div className="community-post-flags">{post.is_announcement && <span><NavIcon name="megaphone" /> Announcement</span>}{post.is_pinned && <span>Featured</span>}{post.moderation_status === "hidden" && <span>Hidden</span>}</div>}
                <header className="community-post-header"><div className="avatar community-avatar">{initialsOf(author?.full_name || "Member")}</div><div><strong>{author?.full_name || "Community member"}</strong><span>{author?.role === "coach" ? "Coach" : categoryById.get(post.category_id || "") || "Member"} · {timeAgo(post.created_at)}</span></div></header>
                <p className="community-post-copy">{post.content}</p>
                <div className="community-post-actions">
                  <button className={liked ? "liked" : ""} disabled={isPending || post.moderation_status === "hidden"} onClick={() => toggleReaction(post.id)}><NavIcon name="star" /> {postReactions.length || "Appreciate"}</button>
                  <button onClick={() => setOpenComments((current) => ({ ...current, [post.id]: !commentsOpen }))}><NavIcon name="message" /> {postComments.length} {postComments.length === 1 ? "reply" : "replies"}</button>
                  {(isCoach || post.author_id === currentUserId) && <div className="community-moderation">{isCoach && <button disabled={isPending} onClick={() => moderate(post)}>{post.moderation_status === "visible" ? "Hide" : "Restore"}</button>}{post.author_id === currentUserId && !post.deleted_at && <button disabled={isPending} onClick={() => removeOwnPost(post.id)}>Delete</button>}</div>}
                </div>
                {commentsOpen && <div className="community-comments">{postComments.map((comment) => { const commenter = memberById.get(comment.author_id); return <div className="community-comment" key={comment.id}><div className="avatar community-avatar small">{initialsOf(commenter?.full_name || "Member")}</div><div><div><strong>{commenter?.full_name || "Community member"}</strong><span>{timeAgo(comment.created_at)}</span></div><p>{comment.content}</p></div></div>; })}<div className="community-comment-form"><input className="rd-input" maxLength={1500} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitComment(post.id); } }} placeholder="Write a thoughtful reply…" value={commentDrafts[post.id] ?? ""} /><button className="btn btn-primary btn-sm" disabled={isPending || !(commentDrafts[post.id] ?? "").trim()} onClick={() => submitComment(post.id)}>Reply</button></div></div>}
              </article>;
            })}
          </div>
        </main>

        <aside className="community-side" id="members">
          <div className="card community-members-card"><div className="community-side-heading"><div><span className="eyebrow">People</span><h2>Members</h2></div><span>{members.length}</span></div><div className="community-member-list">{members.map((member) => <div className="community-member" key={member.id}><div className="avatar community-avatar">{initialsOf(member.full_name || "Member")}</div><div><strong>{member.full_name || "Community member"}</strong><span>{member.role === "coach" ? "Coach · Host" : "Member"}</span></div>{member.role === "coach" && <span className="community-host-dot" title="Community host" />}</div>)}</div></div>
          <div className="community-guideline"><NavIcon name="sparkle" /><div><strong>Keep it generous</strong><span>Celebrate progress, share context, and make every reply useful.</span></div></div>
        </aside>
      </div>
    </>
  );
}
