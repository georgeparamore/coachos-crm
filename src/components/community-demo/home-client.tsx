"use client";

import Link from "next/link";
import { useMemo } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo, CURRENT_STUDENT_ID } from "@/lib/community-demo-store";
import { EVENT_TYPE_LABEL, avatarColorClass, getMember } from "@/lib/community-demo-data";
import { initialsOf } from "@/lib/format";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function HomeClient() {
  const { courses, courseProgress, events, posts, members } = useCommunityDemo();
  const me = getMember(CURRENT_STUDENT_ID)!;

  const inProgress = useMemo(
    () => courses.map((c) => ({ course: c, pct: courseProgress(c) })).filter((c) => c.pct > 0 && c.pct < 100),
    [courses, courseProgress],
  );

  const overallPct = useMemo(() => {
    const all = courses.map((c) => courseProgress(c));
    if (all.length === 0) return 0;
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  }, [courses, courseProgress]);

  const todayEvents = useMemo(() => events.filter((e) => e.date === todayKey()).sort((a, b) => a.time.localeCompare(b.time)), [events]);

  const highlights = useMemo(() => [...posts].sort((a, b) => b.likes - a.likes).slice(0, 3), [posts]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back, {me.name.split(" ")[0]}</div>
          <div className="page-sub">Here&apos;s what&apos;s happening in Ridgeline this week.</div>
        </div>
        <Link href="/community-demo/classroom" className="btn btn-primary">
          Continue learning
        </Link>
      </div>

      <div className="cp-stats-strip">
        <div className="cp-stat">
          <span className="cp-stat-value">{overallPct}%</span>
          <span className="cp-stat-label">overall course progress</span>
        </div>
        <div className="cp-stat">
          <span className="cp-stat-value">{me.points.toLocaleString()}</span>
          <span className="cp-stat-label">community points</span>
        </div>
        <div className="cp-stat">
          <span className="cp-stat-value">{todayEvents.length}</span>
          <span className="cp-stat-label">events today</span>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Continue where you left off</div>
            <Link href="/community-demo/classroom">View all courses</Link>
          </div>
          {inProgress.length === 0 ? (
            <p className="page-sub">No courses in progress — head to the classroom to get started.</p>
          ) : (
            inProgress.map(({ course, pct }) => (
              <Link key={course.id} href={`/community-demo/classroom/${course.id}`} className="cp-continue-row">
                <div className={`cp-course-swatch cp-swatch-${course.color}`}>
                  <NavIcon name="play" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cp-lead-name">{course.title}</div>
                  <div className="cp-progress-track">
                    <div className="cp-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="mini-stat-value">{pct}%</span>
              </Link>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Today&apos;s calendar</div>
            <Link href="/community-demo/calendar">Open calendar</Link>
          </div>
          {todayEvents.length === 0 ? (
            <p className="page-sub">Nothing scheduled today. Enjoy the quiet.</p>
          ) : (
            todayEvents.map((ev) => (
              <div key={ev.id} className="mini-stat-row">
                <div>
                  <div className="mini-stat-value" style={{ fontWeight: 500 }}>
                    {ev.title}
                  </div>
                  <div className="mini-stat-label">
                    {formatTime(ev.time)} · {EVENT_TYPE_LABEL[ev.type]}
                  </div>
                </div>
                {ev.link && (
                  <a href={ev.link} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
                    Join
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">Community highlights</div>
          <Link href="/community-demo/community">Go to community</Link>
        </div>
        {highlights.map((post) => {
          const author = getMember(post.authorId);
          return (
            <div key={post.id} className="cp-highlight-row">
              <div className={`avatar ${avatarColorClass(post.authorId)}`}>{author && initialsOf(author.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mini-stat-value" style={{ fontWeight: 500 }}>
                  {author?.name} <span className="badge badge-blue">{post.category}</span>
                </div>
                <p className="cp-lead-summary">{post.content}</p>
                <div className="mini-stat-label">
                  {post.likes} likes · {post.comments.length} comments
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">New members</div>
          <Link href="/community-demo/members">View directory</Link>
        </div>
        <div className="cp-member-strip">
          {[...members]
            .sort((a, b) => (a.joinedDate < b.joinedDate ? 1 : -1))
            .slice(0, 5)
            .map((m) => (
              <div key={m.id} className="cp-member-chip">
                <div className={`avatar ${avatarColorClass(m.id)}`}>{initialsOf(m.name)}</div>
                <span>{m.name}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
