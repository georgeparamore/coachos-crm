"use client";

import { useState } from "react";
import { NavIcon } from "@/components/nav-icon";

export function ConnectAdsModal({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const [connecting, setConnecting] = useState(false);

  function handleConnect() {
    setConnecting(true);
    // Real version: redirect into Meta's OAuth flow and exchange the code for
    // a long-lived token server-side. This demo just flips a boolean.
    setTimeout(() => {
      onConnect();
    }, 600);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="card-title">Connect Facebook Ads</div>
        <p className="page-sub">
          This would send you through Meta&apos;s OAuth flow to authorize read access to your ad
          account, then pull campaign performance in here automatically. Nothing is wired up to
          Facebook yet — this is a stand-in for that connection.
        </p>
        <div className="card" style={{ background: "var(--surface2)", border: "none" }}>
          <div className="mini-stat-row">
            <span className="mini-stat-label">Permissions requested</span>
          </div>
          <div className="mini-stat-row">
            <span className="mini-stat-label">Read ad account insights</span>
            <NavIcon name="check" />
          </div>
          <div className="mini-stat-row">
            <span className="mini-stat-label">Read campaign performance</span>
            <NavIcon name="check" />
          </div>
        </div>
        <div className="rd-summary-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            <NavIcon name="link" />
            {connecting ? "Connecting…" : "Simulate connection"}
          </button>
        </div>
      </div>
    </div>
  );
}
