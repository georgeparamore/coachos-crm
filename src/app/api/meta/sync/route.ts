import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { syncConnection } from "@/lib/meta/sync";

// Needs Node's crypto module (via lib/meta/sync -> lib/meta/crypto) — not Edge-compatible.
export const runtime = "nodejs";
// Fanning out to Meta's API for every connected coach can run long — this
// route is meant to be hit by Vercel Cron, not by a page load.
export const maxDuration = 300;

/** Cron entry point: syncs every active Meta connection with a selected ad
 * account. Protected by CRON_SECRET so this can't be triggered by anyone
 * who finds the URL — Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * automatically when CRON_SECRET is set in the project's env vars. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: connections, error } = await service
    .from("meta_connections")
    .select("id, coach_id, access_token_encrypted")
    .eq("status", "active");

  if (error) {
    await logServerError(error, "meta.sync.list_connections", {});
    return NextResponse.json({ error: "Failed to list connections" }, { status: 500 });
  }

  const results = { synced: 0, skipped: 0, failed: 0 };

  for (const connection of connections ?? []) {
    try {
      const result = await syncConnection(service, connection);
      if (result.skipped) results.skipped++;
      else results.synced++;
    } catch (err) {
      results.failed++;
      await logServerError(
        { message: err instanceof Error ? err.message : "Unknown sync error" },
        "meta.sync.connection_failed",
        { userId: connection.coach_id },
      );
    }
  }

  return NextResponse.json(results);
}

/** Manual "Sync now" entry point for the signed-in coach's own connection —
 * used by the button on /ads. */
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
    .select("id, coach_id, access_token_encrypted")
    .eq("coach_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "No active Meta connection" }, { status: 404 });
  }

  try {
    const result = await syncConnection(service, connection);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await logServerError({ message }, "meta.sync.manual_failed", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
