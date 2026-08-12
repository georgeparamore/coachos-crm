import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatCurrencyWhole } from "@/lib/analytics";
import { StatTile } from "@/components/charts/stat-tile";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import { MetaSyncButton } from "@/components/meta-sync-button";

export default async function AdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // meta_connections is service-role-only — read connection status with the
  // service client, same pattern as /settings, and never expose the row itself.
  const service = createServiceClient();
  const { data: connection } = await service
    .from("meta_connections")
    .select("id, status")
    .eq("coach_id", user!.id)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">Ad performance</div>
            <div className="page-sub">Campaign spend and leads from Meta (Facebook/Instagram) Ads</div>
          </div>
        </div>
        <div className="empty-state">
          <p>
            Connect your Meta Ads account to see campaign performance here.{" "}
            <Link href="/settings">Go to Settings</Link>
          </p>
        </div>
      </div>
    );
  }

  // meta_ad_accounts / meta_campaigns / meta_ad_insights_daily are all
  // coach-readable directly (coach_id = auth.uid()) — no service client needed.
  const [accountRes, campaignsRes, insightsRes] = await Promise.all([
    supabase
      .from("meta_ad_accounts")
      .select("name, currency")
      .eq("connection_id", connection.id)
      .eq("is_selected", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("meta_campaigns").select("id, meta_campaign_id, name, meta_status, objective").eq("connection_id", connection.id),
    supabase
      .from("meta_ad_insights_daily")
      .select("campaign_id, date, spend_cents, impressions, clicks, leads")
      .eq("coach_id", user!.id)
      .order("date", { ascending: false }),
  ]);

  const { data: account } = accountRes;
  const { data: campaigns } = campaignsRes;
  const { data: insights } = insightsRes;

  const queryErrors = [accountRes.error, campaignsRes.error, insightsRes.error].filter(Boolean);
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "ads.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  const allCampaigns = campaigns ?? [];
  const allInsights = insights ?? [];

  const totalSpendCents = allInsights.reduce((sum, i) => sum + i.spend_cents, 0);
  const totalLeads = allInsights.reduce((sum, i) => sum + i.leads, 0);
  const totalClicks = allInsights.reduce((sum, i) => sum + i.clicks, 0);
  const totalImpressions = allInsights.reduce((sum, i) => sum + i.impressions, 0);
  const costPerLead = totalLeads > 0 ? formatCurrencyWhole(totalSpendCents / totalLeads) : "—";

  const spendByCampaign = new Map<string, { spendCents: number; leads: number; clicks: number }>();
  for (const row of allInsights) {
    const existing = spendByCampaign.get(row.campaign_id) ?? { spendCents: 0, leads: 0, clicks: 0 };
    existing.spendCents += row.spend_cents;
    existing.leads += row.leads;
    existing.clicks += row.clicks;
    spendByCampaign.set(row.campaign_id, existing);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Ad performance</div>
          <div className="page-sub">
            Campaign spend and leads from Meta (Facebook/Instagram) Ads
            {account ? ` · ${account.name}` : ""}
          </div>
        </div>
        <MetaSyncButton />
      </div>

      {queryErrors.length > 0 && <DataLoadError what="your ad performance data" />}

      <div className="metrics">
        <StatTile label="Total spend" value={formatCurrencyWhole(totalSpendCents)} sub="All synced campaigns" />
        <StatTile label="Leads" value={String(totalLeads)} sub="Reported by Meta" />
        <StatTile label="Cost per lead" value={costPerLead} sub="Spend ÷ leads" />
        <StatTile label="Clicks" value={String(totalClicks)} sub={`${totalImpressions.toLocaleString()} impressions`} />
      </div>

      <div className="card">
        <div className="card-title">Campaigns</div>
        {allCampaigns.length === 0 ? (
          <div className="empty-state">
            <p>
              Connected, but no campaign data has synced yet. Click <strong>Sync now</strong> above, or wait for
              the next scheduled sync — campaigns and daily spend/lead numbers will appear here automatically
              after that.
            </p>
          </div>
        ) : (
          allCampaigns.map((c) => {
            const totals = spendByCampaign.get(c.id) ?? { spendCents: 0, leads: 0, clicks: 0 };
            return (
              <div className="list-row" key={c.id}>
                <div>
                  <div className="name">{c.name}</div>
                  <div className="sub">
                    {c.meta_status ?? "Unknown status"}
                    {c.objective ? ` · ${c.objective}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="name">{formatCurrencyWhole(totals.spendCents)}</div>
                  <div className="sub">
                    {totals.leads} leads · {totals.clicks} clicks
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
