import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

/** Toggles whether one of the coach's Meta ad accounts is included in
 * syncing, and/or updates its label. More than one account can be selected
 * at once per connection (e.g. separate businesses under the same Meta
 * login) — this only ever touches the target row, never clears others. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const adAccountId = body?.adAccountId;
  const selected = typeof body?.selected === "boolean" ? body.selected : undefined;
  const label = typeof body?.label === "string" ? body.label.trim() : undefined;

  if (typeof adAccountId !== "string") {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }
  if (selected === undefined && label === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const service = createServiceClient();

  // Ownership check: the target row must belong to this coach.
  const { data: target } = await service
    .from("meta_ad_accounts")
    .select("id")
    .eq("id", adAccountId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (selected !== undefined) update.is_selected = selected;
  if (label !== undefined) update.label = label || null;

  const { error } = await service.from("meta_ad_accounts").update(update).eq("id", target.id);
  if (error) {
    await logServerError(error, "meta.select_account.update", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to update ad account" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
