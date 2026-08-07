"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NavIcon } from "@/components/nav-icon";
import { StatTile } from "@/components/charts/stat-tile";
import { BarList } from "@/components/charts/bar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { EVENT_TYPE_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_BADGE, LEAD_STATUS_LABEL, getMember, type DemoLead } from "@/lib/community-demo-data";
import { EmailLeadModal } from "@/components/community-demo/email-lead-modal";

const SIGNUP_TREND = [
  { label: "Mon", value: 3 },
  { label: "Tue", value: 5 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 7 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 8 },
];

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

export function AdminOverview() {
  const { courses, courseProgress, members, leads, posts, events, emailedLeadIds, markLeadEmailed } = useCommunityDemo();
  const [emailingLead, setEmailingLead] = useState<DemoLead | null>(null);

  const students = useMemo(() => members.filter((m) => m.role === "student"), [members]);

  const avgCompletion = useMemo(() => {
    const pcts = courses.map((c) => courseProgress(c));
    if (pcts.length === 0) return 0;
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [courses, courseProgress]);

  const newLeads = useMemo(() => leads.filter((l) => l.status === "new").length, [leads]);

  const recentLeads = useMemo(() => [...leads].sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1)).slice(0, 4), [leads]);

  const todayEvents = useMemo(
    () => events.filter((e) => e.date === todayKey()).sort((a, b) => a.time.localeCompare(b.time)),
    [events],
  );

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
      <div className="two-col">
        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Recent leads</div>
            <Link href="/community-demo/admin/leads">View all leads</Link>
          </div>
          {recentLeads.length === 0 && <p className="page-sub">No leads yet.</p>}
          {recentLeads.map((lead) => (
            <div key={lead.id} className="mini-stat-row">
              <div>
                <span className="mini-stat-value" style={{ fontWeight: 500 }}>
                  {lead.name}
                </span>{" "}
                <span className={`badge ${LEAD_STATUS_BADGE[lead.status]}`}>{LEAD_STATUS_LABEL[lead.status]}</span>
                <div className="mini-stat-label">
                  {LEAD_SOURCE_LABEL[lead.source]} · {lead.joinedAt}
                </div>
              </div>
              <button
                className={`btn btn-sm${emailedLeadIds.has(lead.id) ? "" : " btn-primary"}`}
                onClick={() => setEmailingLead(lead)}
              >
                <NavIcon name="mail" />
                {emailedLeadIds.has(lead.id) ? "Emailed" : "Email"}
              </button>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title-row">
            <div className="card-title">Today&apos;s schedule</div>
            <Link href="/community-demo/admin/calendar">Open calendar</Link>
          </div>
          {todayEvents.length === 0 ? (
            <p className="page-sub">Nothing scheduled today.</p>
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

      {emailingLead && (
        <EmailLeadModal
          lead={emailingLead}
          onClose={() => setEmailingLead(null)}
          onSend={() => markLeadEmailed(emailingLead.id)}
        />
      )}
    </div>
  );
}
