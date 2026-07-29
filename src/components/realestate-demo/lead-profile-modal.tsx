"use client";

import { STAGE_BADGE, SOURCE_LABEL, getListing, type DemoLead } from "@/lib/realestate-demo-data";

export function LeadProfileModal({
  lead,
  called,
  onClose,
}: {
  lead: DemoLead;
  called: boolean;
  onClose: () => void;
}) {
  const listing = getListing(lead.listingId);
  const initials = lead.name
    .split(" ")
    .map((p) => p[0])
    .join("");

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal rd-call-modal">
        <div className="rd-call-header">
          <div className="rd-call-avatar">{initials}</div>
          <div>
            <div className="rd-call-name">{lead.name}</div>
            <div className="rd-call-sub">{lead.phone}</div>
          </div>
        </div>

        <div className="rd-map-filters" style={{ marginBottom: 16 }}>
          <span className={`badge ${STAGE_BADGE[lead.stage]}`}>{lead.stage}</span>
          <span className="badge badge-blue">{lead.intent === "buying" ? "Buying" : "Selling"}</span>
          <span className="badge badge-purple">{SOURCE_LABEL[lead.source]}</span>
        </div>

        <div className="rd-summary-row" style={{ borderTop: "none", paddingTop: 0 }}>
          <span className="mini-stat-label">Budget</span>
          <span className="mini-stat-value" style={{ fontWeight: 400, fontSize: 13 }}>
            {lead.budget}
          </span>
        </div>
        <div className="rd-summary-row">
          <span className="mini-stat-label">Interested in</span>
          <span className="mini-stat-value" style={{ fontWeight: 400, fontSize: 13, textAlign: "right" }}>
            {listing ? `${listing.address}, ${listing.city}` : "—"}
          </span>
        </div>

        {called ? (
          <div style={{ marginTop: 18 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>
              Last call summary
            </div>
            <ul className="rd-summary-points">
              {lead.aiSummary.keyPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <div className="rd-summary-row">
              <span className="mini-stat-label">Sentiment</span>
              <span className="badge badge-green">{lead.aiSummary.sentiment}</span>
            </div>
            <div className="rd-summary-row">
              <span className="mini-stat-label">Next step</span>
              <span className="mini-stat-value" style={{ fontWeight: 400, fontSize: 13, textAlign: "right" }}>
                {lead.aiSummary.nextStep}
              </span>
            </div>
          </div>
        ) : (
          <div className="rd-empty-note">No calls yet — a summary will appear here after the first call.</div>
        )}

        <div className="rd-summary-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
