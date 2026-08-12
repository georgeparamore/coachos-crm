"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";
import { MetaTokenConnectForm } from "@/components/meta-token-connect-form";

export function MetaConnectionRow({
  connected,
  adAccountName,
  metaAppId,
}: {
  connected: boolean;
  adAccountName: string | null;
  metaAppId: string | null;
}) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/meta/disconnect", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to disconnect");
      }
      router.refresh();
    } catch (err) {
      showError(err, "settings.meta-disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="list-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <div className="list-row-left">
          <div>
            <div className="name">Meta Ads (Facebook/Instagram)</div>
            <div className="sub">
              {connected ? `Ad performance data${adAccountName ? ` · ${adAccountName}` : ""}` : "Campaign spend & leads in the CRM"}
            </div>
          </div>
        </div>
        {connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge badge-green">Connected</span>
            <button className="btn btn-sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <a href="/api/meta/connect" className="btn btn-sm btn-primary">
            Connect
          </a>
        )}
      </div>
      {!connected && <MetaTokenConnectForm metaAppId={metaAppId} />}
    </div>
  );
}
