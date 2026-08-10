import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { verifyOAuthState, encryptToken } from "@/lib/meta/crypto";
import { exchangeCodeForToken, exchangeForLongLivedToken, fetchMetaUserId, fetchAdAccounts, MetaApiError } from "@/lib/meta/client";

// Needs Node's crypto module (via lib/meta/crypto) — not Edge-compatible.
export const runtime = "nodejs";

function redirectToSettings(request: Request, status: "connected" | "error", detail?: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("meta", status);
  if (detail) url.searchParams.set("meta_detail", detail);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    // User declined the Meta dialog, or Meta rejected the request — not a
    // bug, just log lightly and bounce back with a plain status.
    return redirectToSettings(request, "error", "declined");
  }

  if (!code || !state) {
    return redirectToSettings(request, "error", "missing_params");
  }

  const statePayload = verifyOAuthState(state);
  if (!statePayload) {
    return redirectToSettings(request, "error", "invalid_state");
  }

  // Defense in depth: the signed state proves the request came from a
  // connect flow we initiated for this coach, but we still confirm the
  // *current* session matches before writing anything.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== statePayload.coachId) {
    return redirectToSettings(request, "error", "session_mismatch");
  }

  // This must exactly match the URI used by /api/meta/connect, including the
  // active Vercel alias, or Meta rejects the code exchange.
  const redirectUri = new URL("/api/meta/callback", request.url).toString();
  const service = createServiceClient();

  try {
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.accessToken);
    const metaUserId = await fetchMetaUserId(longLived.accessToken);
    const encrypted = encryptToken(longLived.accessToken);
    const tokenExpiresAt = longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString() : null;

    const { data: connection, error: connectionError } = await service
      .from("meta_connections")
      .upsert(
        {
          coach_id: user.id,
          meta_user_id: metaUserId,
          status: "active",
          access_token_encrypted: encrypted,
          token_expires_at: tokenExpiresAt,
          connected_at: new Date().toISOString(),
          last_validated_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "coach_id" },
      )
      .select("id")
      .single();

    if (connectionError || !connection) {
      await logServerError(connectionError, "meta.callback.upsert_connection", { userId: user.id, userEmail: user.email });
      return redirectToSettings(request, "error", "save_failed");
    }

    // Best-effort: pull the ad accounts now so the coach can pick one
    // without an extra round trip. If this fails, the connection itself
    // still succeeded — account selection can be retried from Settings.
    try {
      const accounts = await fetchAdAccounts(longLived.accessToken);
      if (accounts.length > 0) {
        await service.from("meta_ad_accounts").upsert(
          accounts.map((a) => ({
            coach_id: user.id,
            connection_id: connection.id,
            meta_ad_account_id: a.id,
            name: a.name,
            currency: a.currency,
            timezone: a.timezone_name ?? null,
            // Auto-select when there's exactly one account — otherwise leave
            // the choice to the coach (account-picker UI is a follow-up).
            is_selected: accounts.length === 1,
          })),
          { onConflict: "connection_id,meta_ad_account_id" },
        );
      }
    } catch (err) {
      await logServerError(
        { message: err instanceof Error ? err.message : "Failed to fetch ad accounts" },
        "meta.callback.fetch_ad_accounts",
        { userId: user.id, userEmail: user.email },
      );
    }

    return redirectToSettings(request, "connected");
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : err instanceof Error ? err.message : "Unknown error";
    await logServerError({ message }, "meta.callback.token_exchange", { userId: user.id, userEmail: user.email });
    return redirectToSettings(request, "error", "token_exchange_failed");
  }
}
