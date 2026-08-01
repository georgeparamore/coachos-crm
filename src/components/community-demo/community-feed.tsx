"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { CATEGORIES, getMember, ROLE_BADGE, avatarColorClass, type DemoPost } from "@/lib/community-demo-data";
import { initialsOf } from "@/lib/format";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function PostCard({ post }: { post: DemoPost }) {
  const { likePost, addComment } = useCommunityDemo();
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const author = getMember(post.authorId);

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    addComment(post.id, draft.trim());
    setDraft("");
  }

  return (
    <div className="card cp-post">
      {post.pinned && (
        <div className="badge badge-amber" style={{ marginBottom: 10 }}>
          Pinned by admin
        </div>
      )}
      <div className="cp-post-header">
        <div className={`avatar ${avatarColorClass(post.authorId)}`}>{author && initialsOf(author.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cp-lead-name">
            {author?.name}{" "}
            {author && (
              <span className={`badge ${ROLE_BADGE[author.role]}`} style={{ marginLeft: 4 }}>
                {author.role}
              </span>
            )}
          </div>
          <div className="mini-stat-label">
            {timeAgo(post.createdAt)} · {post.category}
          </div>
        </div>
      </div>
      <p className="cp-post-content">{post.content}</p>
      <div className="cp-post-actions">
        <button className="btn btn-sm" onClick={() => likePost(post.id)}>
          <NavIcon name="star" /> {post.likes}
        </button>
        <button className="btn btn-sm" onClick={() => setShowComments((v) => !v)}>
          <NavIcon name="message" /> {post.comments.length} comments
        </button>
      </div>

      {showComments && (
        <div className="cp-comments">
          {post.comments.map((c) => {
            const commenter = getMember(c.authorId);
            return (
              <div key={c.id} className="cp-comment">
                <div className={`avatar ${avatarColorClass(c.authorId)}`} style={{ width: 26, height: 26, fontSize: 11 }}>
                  {commenter && initialsOf(commenter.name)}
                </div>
                <div>
                  <span className="mini-stat-value" style={{ fontWeight: 500 }}>
                    {commenter?.name}
                  </span>
                  <p className="cp-lead-summary" style={{ margin: 0 }}>
                    {c.content}
                  </p>
                </div>
              </div>
            );
          })}
          <form onSubmit={submitComment} className="cp-comment-form">
            <input
              className="rd-input"
              placeholder="Write a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function CommunityFeed() {
  const { posts, members, addPost } = useCommunityDemo();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | "all">("all");
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState<(typeof CATEGORIES)[number]>("General");

  const filtered = useMemo(() => {
    const list = category === "all" ? posts : posts.filter((p) => p.category === category);
    return [...list].sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
  }, [posts, category]);

  const leaderboard = useMemo(() => [...members].sort((a, b) => b.points - a.points).slice(0, 5), [members]);

  function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    addPost(draft.trim(), draftCategory);
    setDraft("");
  }

  return (
    <div className="cp-feed-layout">
      <div>
        <form className="card cp-composer" onSubmit={submitPost}>
          <textarea
            className="rd-input rd-textarea"
            placeholder="Share a win, ask a question, or start a discussion…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="cp-composer-footer">
            <select
              className="rd-input"
              style={{ width: 160 }}
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value as (typeof CATEGORIES)[number])}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
              Post
            </button>
          </div>
        </form>

        <div className="cp-category-tabs">
          <button className={`btn btn-sm${category === "all" ? " btn-primary" : ""}`} onClick={() => setCategory("all")}>
            All posts
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`btn btn-sm${category === c ? " btn-primary" : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        {filtered.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <div className="card" style={{ height: "fit-content" }}>
        <div className="card-title">Top members this month</div>
        {leaderboard.map((m, i) => (
          <div key={m.id} className="mini-stat-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mini-stat-label">#{i + 1}</span>
              <div className={`avatar ${avatarColorClass(m.id)}`} style={{ width: 28, height: 28, fontSize: 11 }}>
                {initialsOf(m.name)}
              </div>
              <span className="mini-stat-value" style={{ fontWeight: 500 }}>
                {m.name}
              </span>
            </div>
            <span className="mini-stat-label">{m.points.toLocaleString()} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
