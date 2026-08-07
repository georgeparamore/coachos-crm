import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta/crypto";
import { fetchAdAccounts, MetaApiError } from "@/lib/meta/client";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

/** Re-pulls the list of ad accounts visible to the coach's existing Meta
 * token — for accounts newly shared with them (e.g. via Assign Partner)
 * after the original connect, which a full OAuth reconnect would otherwise
 * be the only way to pick up. Never touches is_selected on accounts that
 * already exist; only auto-selects when this is the very first account
 * ever seen on the connection. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: connection } = await service
    .from("meta_connections")
    .select("id, access_token_encrypted")
    .eq("coach_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!connection || !connection.access_token_encrypted) {
    return NextResponse.json({ error: "No active Meta connection" }, { status: 404 });
  }

  try {
    const accessToken = decryptToken(connection.access_token_encrypted);
    const accounts = await fetchAdAccounts(accessToken);

    const { count: existingCount } = await service
      .from("meta_ad_accounts")
      .select("id", { count: "exact", head: true })
      .eq("connection_id", connection.id);

    // Only true on a connection that has never had any accounts synced —
    // safe to auto-select in that case, same as the original connect flow.
    const shouldAutoSelect = (existingCount ?? 0) === 0 && accounts.length === 1;

    if (accounts.length > 0) {
      const { error } = await service.from("meta_ad_accounts").upsert(
        accounts.map((a) => ({
          coach_id: user.id,
          connection_id: connection.id,
          meta_ad_account_id: a.id,
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          ...(shouldAutoSelect ? { is_selected: true } : {}),
        })),
        { onConflict: "connection_id,meta_ad_account_id", ignoreDuplicates: false },
      );
      if (error) throw error;
    }

    return NextResponse.json({ accountsFound: accounts.length });
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : err instanceof Error ? err.message : "Unknown error";
    await logServerError({ message }, "meta.refresh_accounts", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
