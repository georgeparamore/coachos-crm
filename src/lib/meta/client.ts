// Server-only. Thin, typed wrapper over the parts of Meta's Graph/Marketing
// API this app needs: OAuth token exchange, listing ad accounts, campaigns,
// and daily insights. Every call is explicitly versioned (META_API_VERSION)
// and timeout-bounded — never let a hung request to Meta hang a page render
// or a sync job indefinitely.
//
// Not yet exercised against live Meta data (no real app/credentials existed
// at the time this was written) — the request shapes match Meta's
// documented Marketing API, but treat the exact field names in
// fetchDailyInsights's `actions` handling as the first thing to verify once
// real data is flowing, since "which action_type counts as a lead" can vary
// by campaign objective/ad type.

import { createHmac } from "crypto";

const REQUEST_TIMEOUT_MS = 15_000;

function getMetaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const apiVersion = process.env.META_API_VERSION;
  if (!appId) throw new Error("META_APP_ID is not set");
  if (!appSecret) throw new Error("META_APP_SECRET is not set");
  if (!apiVersion) throw new Error("META_API_VERSION is not set");
  return { appId, appSecret, apiVersion };
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public metaError?: unknown,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function graphFetch<T>(path: string, params: Record<string, string>, init?: RequestInit): Promise<T> {
  const { apiVersion, appSecret } = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${apiVersion}${path}`);
  const securedParams = { ...params };

  // When Meta's "Require app secret proof" security setting is enabled,
  // every server-side Graph request authenticated with a user or system-user
  // token must include HMAC-SHA256(access_token, app_secret). Centralizing it
  // here protects token validation, account discovery, sync, and revoke calls
  // without ever exposing the app secret to the browser.
  if (securedParams.access_token && !securedParams.appsecret_proof) {
    securedParams.appsecret_proof = createHmac("sha256", appSecret)
      .update(securedParams.access_token)
      .digest("hex");
  }

  for (const [key, value] of Object.entries(securedParams)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch(url.toString(), { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new MetaApiError(`Meta API request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`, 0);
      }
      throw err;
    }

    // One retry on 429/5xx — Meta's rate limits and transient errors are
    // common enough to be worth a single backoff, not more (a sync job
    // should fail loudly and get retried on the next scheduled run rather
    // than hammer Meta in a tight loop).
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      res = await fetch(url.toString(), { ...init, signal: controller.signal });
    }

    const body = await res.json();
    if (!res.ok) {
      throw new MetaApiError(body?.error?.message ?? `Meta API error on ${path}`, res.status, body?.error);
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Builds the Meta OAuth dialog URL the browser redirects to. `state` should
 * come from signOAuthState() (src/lib/meta/crypto.ts). */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { appId, apiVersion } = getMetaConfig();
  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  // Show the permission dialog again when a coach previously declined or
  // removed a scope instead of silently returning an under-scoped token.
  url.searchParams.set("auth_type", "rerequest");
  url.searchParams.set("return_scopes", "true");
  // ads_read alone only surfaces ad accounts the user personally
  // administers. business_management is required too when the account is
  // only reachable via a Business Manager the user belongs to as a
  // partner/employee rather than a personal admin — confirmed necessary in
  // testing (account discovery came back empty with ads_read alone).
  url.searchParams.set("scope", "ads_read,business_management,leads_retrieval,pages_show_list,pages_manage_metadata");
  return url.toString();
}

type TokenResponse = { access_token: string; token_type: string; expires_in?: number };

/** Exchanges the OAuth `code` from the callback for a short-lived user
 * access token. */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const { appId, appSecret } = getMetaConfig();
  const data = await graphFetch<TokenResponse>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** Exchanges a short-lived token for a long-lived one (~60 days). Always do
 * this immediately after exchangeCodeForToken — never store the short-lived
 * token. */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const { appId, appSecret } = getMetaConfig();
  const data = await graphFetch<TokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** Best-effort server-side revoke of a token's permissions on Meta's end —
 * call this before deleting our own copy on disconnect. Meta returns
 * `{ success: true }` even for an already-invalid token, so this rarely
 * throws; callers should still treat it as best-effort and not fail the
 * disconnect flow if it does. */
export async function revokeToken(accessToken: string): Promise<void> {
  await graphFetch<{ success: boolean }>("/me/permissions", { access_token: accessToken }, { method: "DELETE" });
}

/** The Meta user id behind an access token — stored on meta_connections so
 * a reconnect can be recognized as "same person" if ever needed. */
export async function fetchMetaUserId(accessToken: string): Promise<string> {
  const data = await graphFetch<{ id: string }>("/me", { fields: "id", access_token: accessToken });
  return data.id;
}

export type MetaLead = {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: { name: string; values?: string[] }[];
};

export async function fetchLead(accessToken: string, leadId: string): Promise<MetaLead> {
  return graphFetch<MetaLead>(`/${leadId}`, {
    fields: "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data",
    access_token: accessToken,
  });
}

export async function fetchPageAccessToken(accessToken: string, pageId: string): Promise<string> {
  const page = await graphFetch<{ access_token?: string }>(`/${pageId}`, { fields: "access_token", access_token: accessToken });
  if (!page.access_token) throw new MetaApiError("Meta did not return a Page access token", 403);
  return page.access_token;
}

export async function subscribePageToLeadgen(pageAccessToken: string, pageId: string): Promise<void> {
  const result = await graphFetch<{ success?: boolean }>(`/${pageId}/subscribed_apps`, { subscribed_fields: "leadgen", access_token: pageAccessToken }, { method: "POST" });
  if (!result.success) throw new MetaApiError("Meta did not confirm the Page leadgen subscription", 400, result);
}

export type MetaAdAccount = {
  id: string; // "act_1234567890"
  name: string;
  currency: string;
  timezone_name?: string;
};

export async function fetchAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const results: MetaAdAccount[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      fields: "id,name,currency,timezone_name",
      access_token: accessToken,
      limit: "100",
    };
    if (after) params.after = after;

    const page = await graphFetch<{ data: MetaAdAccount[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      "/me/adaccounts",
      params,
    );
    results.push(...page.data);
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
  } while (after);

  return results;
}

export type MetaCampaign = {
  id: string;
  name: string;
  status: string; // Meta's own status string, e.g. ACTIVE / PAUSED / ARCHIVED
  objective?: string;
};

export async function fetchCampaigns(accessToken: string, adAccountId: string): Promise<MetaCampaign[]> {
  const results: MetaCampaign[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      fields: "id,name,status,objective",
      access_token: accessToken,
      limit: "100",
    };
    if (after) params.after = after;

    const page = await graphFetch<{ data: MetaCampaign[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `/${adAccountId}/campaigns`,
      params,
    );
    results.push(...page.data);
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
  } while (after);

  return results;
}

export type MetaDailyInsight = {
  campaignId: string;
  date: string; // YYYY-MM-DD
  spendCents: number;
  impressions: number;
  clicks: number;
  leads: number;
  currency: string;
};

type RawInsightRow = {
  campaign_id: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  account_currency?: string;
  actions?: { action_type: string; value: string }[];
};

/** Fetches per-campaign, per-day insight rows for a date range (inclusive).
 * `leads` is summed from the `actions` breakdown where action_type is
 * "lead" — verify this against real data; Meta uses different action_type
 * values for on-Facebook lead forms vs. off-platform conversion leads (e.g.
 * "offsite_conversion.fb_pixel_lead"). This may need a broader match once
 * real campaigns are connected. */
export async function fetchDailyInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string,
): Promise<MetaDailyInsight[]> {
  const results: MetaDailyInsight[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      level: "campaign",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields: "campaign_id,spend,impressions,clicks,actions,account_currency",
      access_token: accessToken,
      limit: "500",
    };
    if (after) params.after = after;

    const page = await graphFetch<{ data: RawInsightRow[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `/${adAccountId}/insights`,
      params,
    );

    for (const row of page.data) {
      const leadAction = row.actions?.find((a) => a.action_type === "lead" || a.action_type.endsWith("_lead"));
      results.push({
        campaignId: row.campaign_id,
        date: row.date_start,
        spendCents: Math.round(parseFloat(row.spend ?? "0") * 100),
        impressions: parseInt(row.impressions ?? "0", 10),
        clicks: parseInt(row.clicks ?? "0", 10),
        leads: leadAction ? parseInt(leadAction.value, 10) : 0,
        currency: row.account_currency ?? "USD",
      });
    }

    after = page.paging?.next ? page.paging.cursors?.after : undefined;
  } while (after);

  return results;
}
