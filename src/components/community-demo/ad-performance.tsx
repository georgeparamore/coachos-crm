"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { StatTile } from "@/components/charts/stat-tile";
import { BarList } from "@/components/charts/bar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { AD_SPEND_TREND, type AdCampaignStatus } from "@/lib/community-demo-data";
import { ConnectAdsModal } from "@/components/community-demo/connect-ads-modal";

const STATUS_BADGE: Record<AdCampaignStatus, string> = {
  active: "badge-green",
  paused: "badge-amber",
  ended: "badge-blue",
};

function formatDollars(n: number) {
  return `$${n.toLocaleString()}`;
}

export function AdPerformance() {
  const { adsConnected, connectAds, disconnectAds, campaigns, setCampaignStatus } = useCommunityDemo();
  const [showConnect, setShowConnect] = useState(false);

  const totals = useMemo(() => {
    const spend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const leads = campaigns.reduce((sum, c) => sum + c.leads, 0);
    const active = campaigns.filter((c) => c.status === "active").length;
    const costPerLead = leads > 0 ? spend / leads : 0;
    return { spend, leads, active, costPerLead };
  }, [campaigns]);

  const platformSpend = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of campaigns) map.set(c.platform, (map.get(c.platform) ?? 0) + c.spend);
    const colors: Record<string, string> = {
      facebook: "var(--chart-stage-new)",
      instagram: "var(--chart-stage-proposal-sent)",
    };
    return Array.from(map.entries()).map(([platform, value]) => ({
      label: platform === "facebook" ? "Facebook" : "Instagram",
      value,
      color: colors[platform],
    }));
  }, [campaigns]);

  if (!adsConnected) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div className="cp-connect-icon">
          <NavIcon name="megaphone" />
        </div>
        <div className="card-title" style={{ marginTop: 10, marginBottom: 4 }}>
          Connect your ad accounts
        </div>
        <p className="page-sub" style={{ maxWidth: 420, margin: "0 auto 18px" }}>
          See campaign spend, reach, and leads from Facebook &amp; Instagram Ads without leaving
          the CRM. This is a placeholder for the real Meta Marketing API connection.
        </p>
        <button className="btn btn-primary" onClick={() => setShowConnect(true)}>
          <NavIcon name="link" />
          Connect Facebook Ads
        </button>
        {showConnect && (
          <ConnectAdsModal
            onClose={() => setShowConnect(false)}
            onConnect={() => {
              connectAds();
              setShowConnect(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <NavIcon name="check-circle" />
          Connected to Facebook Ads · Ridgeline Coaching Ads Account
        </div>
        <button className="btn btn-sm" onClick={disconnectAds}>
          Disconnect
        </button>
      </div>

      <div className="three-col">
        <StatTile label="Ad spend (30 days)" value={formatDollars(totals.spend)} sub={`${totals.active} active campaigns`} />
        <StatTile label="Leads from ads" value={String(totals.leads)} sub="last 30 days" />
        <StatTile label="Blended cost per lead" value={formatDollars(Math.round(totals.costPerLead))} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title">Daily spend</div>
          <SeriesChart points={AD_SPEND_TREND} color="var(--chart-trend)" mode="line" formatValue={(n) => formatDollars(n)} />
        </div>
        <div className="card">
          <div className="card-title">Spend by platform</div>
          <BarList data={platformSpend} formatValue={(n) => formatDollars(n)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="rd-lead-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Platform</th>
              <th>Spend</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>Leads</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="mini-stat-value" style={{ fontWeight: 500 }}>
                    {c.name}
                  </div>
                  <div className="mini-stat-label">Started {c.startDate}</div>
                </td>
                <td className="mini-stat-label">{c.platform === "facebook" ? "Facebook" : "Instagram"}</td>
                <td className="mini-stat-label">{formatDollars(c.spend)}</td>
                <td className="mini-stat-label">{c.impressions.toLocaleString()}</td>
                <td className="mini-stat-label">{c.clicks.toLocaleString()}</td>
                <td className="mini-stat-label">{c.leads}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                </td>
                <td>
                  {c.status === "active" ? (
                    <button className="btn btn-sm" onClick={() => setCampaignStatus(c.id, "paused")}>
                      Pause
                    </button>
                  ) : c.status === "paused" ? (
                    <button className="btn btn-sm btn-primary" onClick={() => setCampaignStatus(c.id, "active")}>
                      Resume
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
