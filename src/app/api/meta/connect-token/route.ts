import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptToken } from "@/lib/meta/crypto";
import { fetchMetaUserId, fetchAdAccounts, MetaApiError } from "@/lib/meta/client";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

/** Alternative to the OAuth "Connect" flow: accepts a token the coach
 * generated themselves in Meta Business Settings (System Users → Generate
 * token), scoped to ads_read on a specific ad account. Exists because the
 * OAuth + cross-business asset-sharing path can hit walls that are on
 * Meta's side, not ours (dev registration blocks, silent "assign asset"
 * failures) — a System User token is generated entirely within the ad
 * account owner's own Business Manager, no OAuth dialog or Business-to-
 * Business sharing required. System User tokens are typically long-lived
 * or non-expiring by design, unlike the short-lived user tokens the OAuth
 * flow exchanges — so this intentionally skips exchangeForLongLivedToken,
 * which is a user-token-specific step. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") {
    return NextResponse.json({ error: "Only a coach account can connect Meta Ads" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const accessToken = body?.accessToken;
  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    return NextResponse.json({ error: "Access token is required" }, { status: 400 });
  }
  const trimmedToken = accessToken.trim();

  const service = createServiceClient();

  try {
    const metaUserId = await fetchMetaUserId(trimmedToken);
    const encrypted = encryptToken(trimmedToken);

    const { data: connection, error: connectionError } = await service
      .from("meta_connections")
      .upsert(
        {
          coach_id: user.id,
          meta_user_id: metaUserId,
          status: "active",
          access_token_encrypted: encrypted,
          // System User tokens are typically non-expiring or very long-lived
          // and Meta doesn't return an expires_in for them the way it does
          // for OAuth user tokens — leave null rather than guess.
          token_expires_at: null,
          connected_at: new Date().toISOString(),
          last_validated_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "coach_id" },
      )
      .select("id")
      .single();

    if (connectionError || !connection) {
      await logServerError(connectionError, "meta.connect_token.upsert_connection", { userId: user.id, userEmail: user.email });
      return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
    }

    let accountsFound = 0;
    try {
      const accounts = await fetchAdAccounts(trimmedToken);
      accountsFound = accounts.length;
      if (accounts.length > 0) {
        await service.from("meta_ad_accounts").upsert(
          accounts.map((a) => ({
            coach_id: user.id,
            connection_id: connection.id,
            meta_ad_account_id: a.id,
            name: a.name,
            currency: a.currency,
            timezone: a.timezone_name ?? null,
            is_selected: accounts.length === 1,
          })),
          { onConflict: "connection_id,meta_ad_account_id" },
        );
      }
    } catch (err) {
      await logServerError(
        { message: err instanceof Error ? err.message : "Failed to fetch ad accounts" },
        "meta.connect_token.fetch_ad_accounts",
        { userId: user.id, userEmail: user.email },
      );
    }

    return NextResponse.json({ ok: true, accountsFound });
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Meta rejected that token: ${message}` }, { status: 400 });
  }
}
