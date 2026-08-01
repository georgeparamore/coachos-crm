"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_BADGE, type DemoLead, type LeadStatus } from "@/lib/community-demo-data";
import { EmailLeadModal } from "@/components/community-demo/email-lead-modal";

const STATUSES: (LeadStatus | "all")[] = ["all", "new", "contacted", "trial", "won", "lost"];

export function LeadsTable() {
  const { leads, updateLeadStatus, emailedLeadIds, markLeadEmailed } = useCommunityDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [emailingLead, setEmailingLead] = useState<DemoLead | null>(null);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchesStatus = status === "all" || l.status === status;
      const matchesQuery = query.trim() === "" || l.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [leads, query, status]);

  return (
    <div>
      <div className="rd-leads-toolbar">
        <input className="rd-search" placeholder="Search leads by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="rd-map-filters">
          {STATUSES.map((s) => (
            <button key={s} className={`btn btn-sm${status === s ? " btn-primary" : ""}`} onClick={() => setStatus(s)}>
              {s === "all" ? "All statuses" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="rd-lead-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Joined</th>
              <th>Status</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div className="mini-stat-value" style={{ fontWeight: 500 }}>
                    {lead.name}
                  </div>
                  <div className="mini-stat-label">{lead.email}</div>
                </td>
                <td className="mini-stat-label">{LEAD_SOURCE_LABEL[lead.source]}</td>
                <td className="mini-stat-label">{lead.joinedAt}</td>
                <td>
                  <select
                    className="rd-input"
                    style={{ width: 130, padding: "5px 8px" }}
                    value={lead.status}
                    onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                  >
                    {STATUSES.filter((s) => s !== "all").map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${LEAD_STATUS_BADGE[lead.status]}`}>{lead.status}</span>
                  </div>
                </td>
                <td>
                  <button
                    className={`btn btn-sm${emailedLeadIds.has(lead.id) ? "" : " btn-primary"}`}
                    onClick={() => setEmailingLead(lead)}
                  >
                    <NavIcon name="mail" />
                    {emailedLeadIds.has(lead.id) ? "Emailed" : "Email"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="mini-stat-label" style={{ textAlign: "center", padding: 24 }}>
                  No leads match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
