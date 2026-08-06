import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { decryptToken } from "@/lib/meta/crypto";
import { revokeToken } from "@/lib/meta/client";

// Needs Node's crypto module (via lib/meta/crypto) — not Edge-compatible.
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: connection, error: fetchError } = await service
    .from("meta_connections")
    .select("id, access_token_encrypted")
    .eq("coach_id", user.id)
    .single();

  if (fetchError || !connection) {
    return NextResponse.json({ error: "No Meta connection found" }, { status: 404 });
  }

  if (connection.access_token_encrypted) {
    try {
      const token = decryptToken(connection.access_token_encrypted);
      await revokeToken(token);
    } catch (err) {
      // Best-effort — an already-expired/invalid token, or a transient Meta
      // API failure, shouldn't block the local disconnect below.
      await logServerError(
        { message: err instanceof Error ? err.message : "Failed to revoke token with Meta" },
        "meta.disconnect.revoke",
        { userId: user.id, userEmail: user.email },
      );
    }
  }

  const { error: updateError } = await service
    .from("meta_connections")
    .update({
      status: "disconnected",
      access_token_encrypted: null,
      token_expires_at: null,
      disconnected_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (updateError) {
    await logServerError(updateError, "meta.disconnect.update", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
