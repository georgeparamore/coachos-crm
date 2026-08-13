import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processLead } from "@/app/api/meta/webhook/route";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const service = createServiceClient();
  const { data: events } = await service.from("meta_lead_webhook_events").select("payload").eq("coach_id", user.id).eq("status", "failed").lt("attempt_count", 5).order("created_at").limit(20);
  for (const event of events ?? []) await processLead(event.payload as Record<string, unknown>);
  return NextResponse.json({ ok: true, retried: events?.length ?? 0 });
}
