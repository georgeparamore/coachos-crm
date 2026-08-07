"use client";

import { useState } from "react";
import type { DemoLead } from "@/lib/community-demo-data";

export function EmailLeadModal({
  lead,
  onClose,
  onSend,
}: {
  lead: DemoLead;
  onClose: () => void;
  onSend: () => void;
}) {
  const [subject, setSubject] = useState("Your Ridgeline Coaching trial");
  const [body, setBody] = useState(
    `Hi ${lead.name.split(" ")[0]},\n\nThanks for checking out Ridgeline Coaching — wanted to follow up and see if you had any questions about the community or the group program.\n\nHappy to jump on a quick call this week if that's helpful.\n\nBest,\nJordan`,
  );
  const [sent, setSent] = useState(false);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    onSend();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSend}>
        <div className="card-title">Email {lead.name}</div>
        <p className="mini-stat-label" style={{ marginTop: -8, marginBottom: 14 }}>
          To: {lead.email}
        </p>

        {sent ? (
          <div className="card" style={{ background: "var(--green-bg)", border: "none", textAlign: "center" }}>
            <span style={{ color: "var(--green-text)" }}>Email sent to {lead.email}.</span>
          </div>
        ) : (
          <>
            <label className="rd-field">
              <span className="rd-field-label">Subject</span>
              <input className="rd-input" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </label>
            <label className="rd-field">
              <span className="rd-field-label">Message</span>
              <textarea
                className="rd-input rd-textarea"
                style={{ minHeight: 140 }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </label>
          </>
        )}

        <div className="rd-summary-actions">
          <button type="button" className="btn" onClick={onClose}>
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button type="submit" className="btn btn-primary">
              Send email
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
