"use client";

import { useMemo } from "react";
import { useCommunityDemo } from "@/lib/community-demo-store";

// Illustrative per-student completion — this demo tracks live progress for a
// single logged-in learner, so the rest of the roster gets a stable pseudo
// value (seeded from the id) just to make the table read like real data.
function seededPct(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 97;
  return 35 + (hash % 60);
}

function seededLastActive(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 17 + ch.charCodeAt(0)) % 97;
  const days = hash % 9;
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export function StudentProgressTable() {
  const { members, courses, courseProgress } = useCommunityDemo();

  const rows = useMemo(
    () =>
      members
        .filter((m) => m.role === "student")
        .map((m) => {
          // "Sarah Chen" (m1) is the demo's logged-in learner — show her real, live progress.
          const pct =
            m.id === "m1"
              ? Math.round(courses.reduce((sum, c) => sum + courseProgress(c), 0) / Math.max(courses.length, 1))
              : seededPct(m.id);
          return { member: m, pct, lastActive: seededLastActive(m.id) };
        })
        .sort((a, b) => b.pct - a.pct),
    [members, courses, courseProgress],
  );

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="rd-lead-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Courses enrolled</th>
            <th>Avg. completion</th>
            <th>Last active</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ member, pct, lastActive }) => (
            <tr key={member.id}>
              <td>
                <div className="mini-stat-value" style={{ fontWeight: 500 }}>
                  {member.name}
                </div>
                <div className="mini-stat-label">{member.title}</div>
              </td>
              <td className="mini-stat-label">{member.coursesEnrolled}</td>
              <td style={{ minWidth: 140 }}>
                <div className="cp-progress-track">
                  <div className="cp-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="mini-stat-label">{pct}%</span>
              </td>
              <td className="mini-stat-label">{lastActive}</td>
              <td>
                <span className={`badge ${pct >= 70 ? "badge-green" : pct >= 40 ? "badge-amber" : "badge-red"}`}>
                  {pct >= 70 ? "On track" : pct >= 40 ? "Slipping" : "At risk"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
