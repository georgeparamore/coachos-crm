"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { CallModal } from "@/components/realestate-demo/call-modal";
import {
  DEMO_LEADS,
  STAGE_BADGE,
  getListing,
  type DemoLead,
  type DemoStage,
} from "@/lib/realestate-demo-data";

const PRIORITY: Record<DemoStage, number> = {
  "Hot Lead": 0,
  New: 1,
  "In Conversation": 2,
  "Follow Up": 3,
  "Showing Booked": 4,
};

export function HomeClient() {
  const [leads, setLeads] = useState<DemoLead[]>(DEMO_LEADS);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [session, setSession] = useState({ calls: 0, booked: 0, followUps: 0 });
  const [showSessionEnd, setShowSessionEnd] = useState(false);

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => PRIORITY[a.stage] - PRIORITY[b.stage]),
    [leads],
  );

  const hotCount = leads.filter((l) => l.stage === "Hot Lead").length;
  const bookedToday = 2; // static, illustrative — this demo doesn't wire a real calendar

  const activeLead = activeLeadId ? leads.find((l) => l.id === activeLeadId) ?? null : null;

  function startSession() {
    setSession({ calls: 0, booked: 0, followUps: 0 });
    const ids = sortedLeads.map((l) => l.id);
    setQueue(ids.slice(1));
    setActiveLeadId(ids[0]);
  }

  function callSingle(id: string) {
    setQueue(null);
    setActiveLeadId(id);
  }

  function handleConfirm(newStage: DemoStage) {
    if (!activeLead) return;
    setLeads((prev) => prev.map((l) => (l.id === activeLead.id ? { ...l, stage: newStage } : l)));
    setSession((s) => ({
      calls: s.calls + 1,
      booked: s.booked + (newStage === "Showing Booked" ? 1 : 0),
      followUps: s.followUps + (newStage === "Follow Up" ? 1 : 0),
    }));

    if (queue && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setActiveLeadId(next);
    } else if (queue) {
      setQueue(null);
      setActiveLeadId(null);
      setShowSessionEnd(true);
    } else {
      setActiveLeadId(null);
    }
  }

  function handleClose() {
    setQueue(null);
    setActiveLeadId(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Good morning, Maria</div>
          <div className="page-sub">Here&apos;s what needs your attention today.</div>
        </div>
        <button className="btn btn-accent" onClick={startSession}>
          Start call session
        </button>
      </div>

      <div className="rd-stats-strip">
        <div className="rd-stat">
          <span className="rd-stat-value">{leads.length}</span>
          <span className="rd-stat-label">leads to call today</span>
        </div>
        <div className="rd-stat">
          <span className="rd-stat-value">{bookedToday}</span>
          <span className="rd-stat-label">showings booked</span>
        </div>
        <div className="rd-stat">
          <span className="rd-stat-value">{hotCount}</span>
          <span className="rd-stat-label">hot leads</span>
        </div>
      </div>

      <div className="rd-queue">
        {sortedLeads.map((lead) => {
          const listing = getListing(lead.listingId);
          return (
            <div key={lead.id} className="card rd-lead-card">
              <div className="rd-lead-card-main">
                <div className="rd-lead-card-top">
                  <span className="rd-lead-name">{lead.name}</span>
                  <span className={`badge ${STAGE_BADGE[lead.stage]}`}>{lead.stage}</span>
                </div>
                <div className="page-sub" style={{ marginTop: 2 }}>
                  {lead.intent === "buying" ? "Buying" : "Selling"} · Interested in {listing?.address}
                  {listing ? `, ${listing.city}` : ""}
                </div>
                <p className="rd-lead-summary">{lead.summary}</p>
              </div>
              <button className="btn btn-primary rd-call-btn" onClick={() => callSingle(lead.id)}>
                <NavIcon name="phone" />
                Call
              </button>
            </div>
          );
        })}
      </div>

      {activeLead && (
        <CallModal lead={activeLead} onClose={handleClose} onConfirm={handleConfirm} />
      )}

      {showSessionEnd && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="card-title">Session complete</div>
            <div className="rd-summary-row">
              <span className="mini-stat-label">Calls made</span>
              <span className="mini-stat-value">{session.calls}</span>
            </div>
            <div className="rd-summary-row">
              <span className="mini-stat-label">Showings booked</span>
              <span className="mini-stat-value">{session.booked}</span>
            </div>
            <div className="rd-summary-row">
              <span className="mini-stat-label">Follow-ups scheduled</span>
              <span className="mini-stat-value">{session.followUps}</span>
            </div>
            <div className="rd-summary-actions">
              <button className="btn btn-primary" onClick={() => setShowSessionEnd(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
