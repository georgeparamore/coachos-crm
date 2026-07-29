"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { CallModal } from "@/components/realestate-demo/call-modal";
import { useRealEstateDemo } from "@/lib/realestate-demo-store";
import { STAGE_BADGE, getListing, type DemoStage } from "@/lib/realestate-demo-data";

const PRIORITY: Record<DemoStage, number> = {
  "Hot Lead": 0,
  New: 1,
  "In Conversation": 2,
  "Follow Up": 3,
  "Showing Booked": 4,
};

export function HomeClient() {
  const { leads, calledIds, confirmCall } = useRealEstateDemo();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [session, setSession] = useState({ calls: 0, booked: 0, followUps: 0 });
  const [showSessionEnd, setShowSessionEnd] = useState(false);

  // Once a lead has been called and labeled this session, it drops off the
  // Home queue — it's been triaged and now lives in its stage, browsable from
  // the Leads directory instead.
  const todaysLeads = useMemo(() => leads.filter((l) => !calledIds.has(l.id)), [leads, calledIds]);

  const sortedLeads = useMemo(
    () => [...todaysLeads].sort((a, b) => PRIORITY[a.stage] - PRIORITY[b.stage]),
    [todaysLeads],
  );

  const hotCount = todaysLeads.filter((l) => l.stage === "Hot Lead").length;
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
    confirmCall(activeLead.id, newStage);
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
        <button className="btn btn-accent" onClick={startSession} disabled={sortedLeads.length === 0}>
          Start call session
        </button>
      </div>

      <div className="rd-stats-strip">
        <div className="rd-stat">
          <span className="rd-stat-value">{todaysLeads.length}</span>
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

      {sortedLeads.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            All caught up
          </div>
          <p className="page-sub">Every lead on today&apos;s list has been called. New ones will show up here.</p>
        </div>
      ) : (
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
      )}

      {activeLead && (
        // Keyed by lead id so each call gets a fresh CallModal instance —
        // otherwise auto-advancing to the next lead reuses the previous
        // instance's state and skips straight to the summary screen.
        <CallModal key={activeLead.id} lead={activeLead} onClose={handleClose} onConfirm={handleConfirm} />
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
