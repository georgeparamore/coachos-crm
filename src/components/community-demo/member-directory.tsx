"use client";

import { useMemo, useState } from "react";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { ROLE_BADGE, avatarColorClass, type DemoMember } from "@/lib/community-demo-data";
import { initialsOf } from "@/lib/format";
import { MemberProfileModal } from "@/components/community-demo/member-profile-modal";

export function MemberDirectory() {
  const { members } = useCommunityDemo();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemoMember | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [members, query]);

  return (
    <div>
      <input
        className="rd-search"
        style={{ marginBottom: 16 }}
        placeholder="Search members by name or tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="cp-member-grid">
        {filtered.map((m) => (
          <button key={m.id} className="card cp-member-card" onClick={() => setSelected(m)}>
            <div className={`avatar ${avatarColorClass(m.id)}`} style={{ width: 48, height: 48, fontSize: 16 }}>
              {initialsOf(m.name)}
            </div>
            <div className="cp-lead-name">{m.name}</div>
            <div className="mini-stat-label">{m.title}</div>
            <span className={`badge ${ROLE_BADGE[m.role]}`} style={{ marginTop: 8 }}>
              {m.role}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "32px 20px", gridColumn: "1 / -1" }}>
            <p className="page-sub">No members match your search.</p>
          </div>
        )}
      </div>

      {selected && <MemberProfileModal member={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
