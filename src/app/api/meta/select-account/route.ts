import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

/** Sets which of the coach's Meta ad accounts is the selected one the sync
 * job pulls from. Only one account can be selected per connection — this
 * clears is_selected on the others first. */
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
  if (typeof adAccountId !== "string") {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Ownership check: the target row must belong to this coach, and we need
  // its connection_id to scope the "clear the others" update.
  const { data: target } = await service
    .from("meta_ad_accounts")
    .select("id, connection_id")
    .eq("id", adAccountId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
  }

  const { error: clearError } = await service
    .from("meta_ad_accounts")
    .update({ is_selected: false })
    .eq("connection_id", target.connection_id);
  if (clearError) {
    await logServerError(clearError, "meta.select_account.clear", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to update selection" }, { status: 500 });
  }

  const { error: selectError } = await service.from("meta_ad_accounts").update({ is_selected: true }).eq("id", target.id);
  if (selectError) {
    await logServerError(selectError, "meta.select_account.select", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to update selection" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
