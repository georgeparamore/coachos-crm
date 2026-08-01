"use client";

import { useMemo } from "react";
import Link from "next/link";
import { StatTile } from "@/components/charts/stat-tile";
import { BarList } from "@/components/charts/bar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { LEAD_SOURCE_LABEL, getMember } from "@/lib/community-demo-data";

const SIGNUP_TREND = [
  { label: "Mon", value: 3 },
  { label: "Tue", value: 5 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 7 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 8 },
];

export function AdminOverview() {
  const { courses, courseProgress, members, leads, posts } = useCommunityDemo();

  const students = useMemo(() => members.filter((m) => m.role === "student"), [members]);

  const avgCompletion = useMemo(() => {
    const pcts = courses.map((c) => courseProgress(c));
    if (pcts.length === 0) return 0;
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [courses, courseProgress]);

  const newLeads = useMemo(() => leads.filter((l) => l.status === "new").length, [leads]);

  const sourceData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) counts.set(l.source, (counts.get(l.source) ?? 0) + 1);
    const colors = ["var(--chart-stage-new)", "var(--chart-stage-in-conversation)", "var(--chart-stage-proposal-sent)", "var(--chart-stage-signed)"];
    return Array.from(counts.entries()).map(([source, value], i) => ({
      label: LEAD_SOURCE_LABEL[source as keyof typeof LEAD_SOURCE_LABEL],
      value,
      color: colors[i % colors.length],
    }));
  }, [leads]);

  const recentPosts = useMemo(() => [...posts].slice(0, 4), [posts]);

  return (
    <div>
      <div className="three-col">
        <StatTile label="Total students" value={String(students.length)} sub={`${courses.length} active courses`} />
        <StatTile label="Avg. course completion" value={`${avgCompletion}%`} sub="across all courses" />
        <StatTile label="New leads" value={String(newLeads)} sub={`${leads.length} total in pipeline`} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">New signups, last 7 days</div>
          <SeriesChart points={SIGNUP_TREND} color="var(--chart-trend)" mode="bar" />
        </div>
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Lead sources</div>
            <Link href="/community-demo/admin/leads">View all leads</Link>
          </div>
          <BarList data={sourceData} />
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">Recent community activity</div>
          <Link href="/community-demo/community">View community</Link>
        </div>
        {recentPosts.map((post) => {
          const author = getMember(post.authorId);
          return (
            <div key={post.id} className="mini-stat-row">
              <div>
                <span className="mini-stat-value" style={{ fontWeight: 500 }}>
                  {author?.name}
                </span>
                <p className="cp-lead-summary" style={{ margin: 0 }}>
                  {post.content}
                </p>
              </div>
              <span className="mini-stat-label">{post.likes} likes</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
