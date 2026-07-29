"use client";

import { useEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { STAGE_BADGE, type DemoLead, type DemoStage } from "@/lib/realestate-demo-data";

type CallStage = "ringing" | "connecting" | "live" | "summarizing" | "summary";

const STAGE_OPTIONS: DemoStage[] = ["New", "Hot Lead", "In Conversation", "Showing Booked", "Follow Up"];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallModal({
  lead,
  onClose,
  onConfirm,
}: {
  lead: DemoLead;
  onClose: () => void;
  onConfirm: (stage: DemoStage) => void;
}) {
  const [stage, setStage] = useState<CallStage>("ringing");
  const [lineCount, setLineCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [chosenStage, setChosenStage] = useState<DemoStage>(lead.aiSummary.suggestedStage);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Ringing -> connecting -> live, on a fixed timeline so it feels like a
  // real bridged call without needing any actual telephony behind it.
  useEffect(() => {
    if (stage !== "ringing") return;
    const t = setTimeout(() => setStage("connecting"), 1600);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage !== "connecting") return;
    const t = setTimeout(() => setStage("live"), 1300);
    return () => clearTimeout(t);
  }, [stage]);

  // Call timer, only while live.
  useEffect(() => {
    if (stage !== "live") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // Reveal transcript lines one at a time, like live captions arriving.
  useEffect(() => {
    if (stage !== "live") return;
    if (lineCount >= lead.transcript.length) return;
    const t = setTimeout(() => setLineCount((c) => c + 1), 1900);
    return () => clearTimeout(t);
  }, [stage, lineCount, lead.transcript.length]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lineCount]);

  function endCall() {
    setStage("summarizing");
    setTimeout(() => setStage("summary"), 1500);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal rd-call-modal">
        {stage !== "summary" && stage !== "summarizing" && (
          <div className="rd-call-header">
            <div className="rd-call-avatar">{lead.name.split(" ").map((p) => p[0]).join("")}</div>
            <div>
              <div className="rd-call-name">{lead.name}</div>
              <div className="rd-call-sub">{lead.phone}</div>
            </div>
          </div>
        )}

        {stage === "ringing" && (
          <div className="rd-call-status">
            <div className="rd-call-pulse" />
            <p>Calling your phone first…</p>
            <p className="page-sub">You&apos;ll answer normally, then we bridge in {lead.name.split(" ")[0]}.</p>
          </div>
        )}

        {stage === "connecting" && (
          <div className="rd-call-status">
            <div className="rd-call-pulse" />
            <p>Connecting to {lead.name.split(" ")[0]}…</p>
            <p className="page-sub">This call may be recorded and transcribed for quality and follow-up purposes.</p>
          </div>
        )}

        {stage === "live" && (
          <div className="rd-call-live">
            <div className="rd-call-timer">
              <span className="rd-call-dot" /> Connected · {formatDuration(elapsed)}
            </div>
            <div className="rd-transcript">
              {lead.transcript.slice(0, lineCount).map((line, i) => (
                <div key={i} className={`rd-transcript-line ${i % 2 === 0 ? "rd-transcript-you" : "rd-transcript-lead"}`}>
                  <span className="rd-transcript-speaker">{i % 2 === 0 ? "You" : lead.name.split(" ")[0]}</span>
                  {line}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
            <div className="rd-call-controls">
              <button className="rd-call-icon-btn" onClick={() => setMuted((m) => !m)} aria-label="Mute">
                <NavIcon name="mic" />
                <span>{muted ? "Unmute" : "Mute"}</span>
              </button>
              <button className="rd-call-icon-btn rd-call-end" onClick={endCall}>
                <NavIcon name="phone" />
                <span>End call</span>
              </button>
            </div>
          </div>
        )}

        {stage === "summarizing" && (
          <div className="rd-call-status">
            <div className="rd-call-pulse" />
            <p>Writing up the call…</p>
            <p className="page-sub">Summarizing key points and suggesting a lead label.</p>
          </div>
        )}

        {stage === "summary" && (
          <div className="rd-summary">
            <div className="card-title">Call summary — {lead.name}</div>
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
              <span className="mini-stat-value" style={{ fontWeight: 400, fontSize: 13 }}>
                {lead.aiSummary.nextStep}
              </span>
            </div>
            <div className="rd-summary-label">
              <span className="mini-stat-label">Suggested label — confirm or change it</span>
              <div className="rd-stage-chips">
                {STAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className={`badge ${STAGE_BADGE[s]} rd-stage-chip${chosenStage === s ? " rd-stage-chip-active" : ""}`}
                    onClick={() => setChosenStage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="rd-summary-actions">
              <button className="btn" onClick={onClose}>
                Close without saving
              </button>
              <button className="btn btn-primary" onClick={() => onConfirm(chosenStage)}>
                Confirm &amp; next lead
              </button>
            </div>
          </div>
        )}

        {stage !== "summary" && stage !== "live" && (
          <div className="rd-call-cancel">
            <button className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
