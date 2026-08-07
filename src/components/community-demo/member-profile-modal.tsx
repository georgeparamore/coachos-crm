"use client";

import { ROLE_BADGE, avatarColorClass, type DemoMember } from "@/lib/community-demo-data";
import { initialsOf } from "@/lib/format";

export function MemberProfileModal({ member, onClose }: { member: DemoMember; onClose: () => void }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="cp-profile-header">
          <div className={`avatar ${avatarColorClass(member.id)}`} style={{ width: 56, height: 56, fontSize: 18 }}>
            {initialsOf(member.name)}
          </div>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>
              {member.name}
            </div>
            <div className="mini-stat-label">{member.title}</div>
          </div>
          <span className={`badge ${ROLE_BADGE[member.role]}`}>{member.role}</span>
        </div>

        <p className="cp-lead-summary">{member.bio}</p>

        <div className="rd-summary-row">
          <span className="mini-stat-label">Location</span>
          <span className="mini-stat-value">{member.location}</span>
        </div>
        <div className="rd-summary-row">
          <span className="mini-stat-label">Member since</span>
          <span className="mini-stat-value">{member.joinedDate}</span>
        </div>
        <div className="rd-summary-row">
          <span className="mini-stat-label">Community points</span>
          <span className="mini-stat-value">{member.points.toLocaleString()}</span>
        </div>
        <div className="rd-summary-row">
          <span className="mini-stat-label">Courses enrolled</span>
          <span className="mini-stat-value">{member.coursesEnrolled}</span>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0" }}>
          {member.tags.map((t) => (
            <span key={t} className="badge badge-blue">
              {t}
            </span>
          ))}
        </div>

        <div className="rd-summary-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
