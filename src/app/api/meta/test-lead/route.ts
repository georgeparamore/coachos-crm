import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mapWebsiteLead } from "@/lib/meta/lead-mapping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  const service = createServiceClient();
  const { data: source } = await service.from("meta_lead_sources").select("*").eq("id", sourceId).eq("coach_id", user.id).eq("enabled", true).maybeSingle();
  if (!source) return NextResponse.json({ error: "Choose an enabled Page/form mapping first" }, { status: 400 });

  const syntheticId = `synthetic_${randomUUID()}`;
  const fieldData = [
    { name: "full_name", values: ["Test Website Lead"] },
    { name: "email", values: [`meta-test-${Date.now()}@example.com`] },
    { name: "phone_number", values: ["+15555550199"] },
    { name: "business_name", values: ["Full Circle Test Company"] },
    { name: "current_website", values: ["https://example.com"] },
    { name: "new_website_or_redesign", values: ["Website redesign"] },
    { name: "business_description", values: ["Synthetic service business used to verify CRM lead delivery."] },
    { name: "launch_timeframe", values: ["Within 30 days"] },
    { name: "budget_set_aside", values: ["$2,500–$5,000"] },
  ];
  const { answers, ...mapped } = mapWebsiteLead(fieldData);
  const details = { platform: "meta", synthetic: true, page_id: source.meta_page_id, page_name: source.page_name, form_id: source.meta_form_id, form_name: source.form_name, account_id: source.meta_ad_account_id, answers };
  const { data: lead, error } = await service.from("leads").insert({ ...mapped, coach_id: user.id, business_id: source.business_id, external_source: "meta_test", external_id: syntheticId, source: "Meta Instant Form (test)", stage: "new", service_interest: "Website redesign", source_details: details, submitted_at: new Date().toISOString(), consent_context: { synthetic: true } }).select("id").single();
  if (error) return NextResponse.json({ error: "Synthetic lead could not be created" }, { status: 500 });
  await Promise.all([
    service.from("lead_activities").insert({ coach_id: user.id, lead_id: lead.id, activity_type: "imported", note: "Synthetic Meta test lead", metadata: { meta_lead_id: syntheticId } }),
    service.from("meta_lead_webhook_events").insert({ coach_id: user.id, source_id: source.id, lead_id: lead.id, meta_page_id: source.meta_page_id, meta_form_id: source.meta_form_id, meta_leadgen_id: syntheticId, status: "processed", payload: { synthetic: true }, provider_payload: { id: syntheticId, field_data: fieldData }, attempt_count: 1, last_attempt_at: new Date().toISOString(), processed_at: new Date().toISOString() }),
  ]);
  return NextResponse.json({ ok: true, leadId: lead.id });
}
