import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta/crypto";
import { fetchCampaigns, fetchDailyInsights, MetaApiError } from "@/lib/meta/client";

const INSIGHTS_LOOKBACK_DAYS = 30;

type ServiceClient = ReturnType<typeof createServiceClient>;

type Connection = {
  id: string;
  coach_id: string;
  access_token_encrypted: string | null;
};

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Syncs campaigns + last 30 days of daily insights for one coach's
 * selected ad account. Idempotent — safe to re-run (upserts on the same
 * unique keys the schema defines). Records a meta_sync_runs row either way
 * so /settings and /ads can show sync history/staleness. */
export async function syncConnection(service: ServiceClient, connection: Connection) {
  const { data: adAccount } = await service
    .from("meta_ad_accounts")
    .select("meta_ad_account_id")
    .eq("connection_id", connection.id)
    .eq("is_selected", true)
    .maybeSingle();

  if (!adAccount || !connection.access_token_encrypted) {
    return { skipped: true as const };
  }

  const { data: run } = await service
    .from("meta_sync_runs")
    .insert({ coach_id: connection.coach_id, connection_id: connection.id, status: "running" })
    .select("id")
    .single();

  try {
    const accessToken = decryptToken(connection.access_token_encrypted);

    const campaigns = await fetchCampaigns(accessToken, adAccount.meta_ad_account_id);
    let campaignIdByMetaId = new Map<string, string>();

    if (campaigns.length > 0) {
      const { data: upserted, error: campaignsError } = await service
        .from("meta_campaigns")
        .upsert(
          campaigns.map((c) => ({
            coach_id: connection.coach_id,
            connection_id: connection.id,
            meta_campaign_id: c.id,
            name: c.name,
            meta_status: c.status,
            objective: c.objective ?? null,
          })),
          { onConflict: "connection_id,meta_campaign_id" },
        )
        .select("id, meta_campaign_id");
      if (campaignsError) throw campaignsError;
      campaignIdByMetaId = new Map((upserted ?? []).map((c) => [c.meta_campaign_id, c.id]));
    }

    const since = isoDateDaysAgo(INSIGHTS_LOOKBACK_DAYS);
    const until = isoDateDaysAgo(0);
    const insights = await fetchDailyInsights(accessToken, adAccount.meta_ad_account_id, since, until);

    const insightRows = insights
      .map((row) => {
        const campaignId = campaignIdByMetaId.get(row.campaignId);
        if (!campaignId) return null;
        return {
          coach_id: connection.coach_id,
          campaign_id: campaignId,
          date: row.date,
          spend_cents: row.spendCents,
          impressions: row.impressions,
          clicks: row.clicks,
          leads: row.leads,
          currency: row.currency,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (insightRows.length > 0) {
      const { error: insightsError } = await service
        .from("meta_ad_insights_daily")
        .upsert(insightRows, { onConflict: "campaign_id,date" });
      if (insightsError) throw insightsError;
    }

    await service
      .from("meta_connections")
      .update({ last_validated_at: new Date().toISOString(), status: "active" })
      .eq("id", connection.id);

    if (run) {
      await service
        .from("meta_sync_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          campaigns_synced: campaigns.length,
          insights_synced: insightRows.length,
        })
        .eq("id", run.id);
    }

    return { skipped: false as const, campaignsSynced: campaigns.length, insightsSynced: insightRows.length };
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : err instanceof Error ? err.message : "Unknown sync error";

    // A 401/403 from Meta means the token is dead (revoked/expired) — mark
    // the connection so the UI can prompt a reconnect instead of silently
    // retrying a token that will never work again.
    if (err instanceof MetaApiError && (err.status === 401 || err.status === 403)) {
      await service.from("meta_connections").update({ status: "error" }).eq("id", connection.id);
    }

    if (run) {
      await service
        .from("meta_sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
        .eq("id", run.id);
    }

    throw err;
  }
}
