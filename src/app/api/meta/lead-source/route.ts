import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";
import { decryptToken } from "@/lib/meta/crypto";
import { fetchPageAccessToken, subscribePageToLeadgen } from "@/lib/meta/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") return NextResponse.json({ error: "Only a coach can configure lead intake" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const subscribeSourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  if (subscribeSourceId) {
    const service = createServiceClient();
    const { data: source } = await service.from("meta_lead_sources").select("meta_page_id,connection_id").eq("id", subscribeSourceId).eq("coach_id", user.id).maybeSingle();
    if (!source) return NextResponse.json({ error: "Lead source not found" }, { status: 404 });
    const { data: connection } = await service.from("meta_connections").select("access_token_encrypted").eq("id", source.connection_id).eq("status", "active").maybeSingle();
    if (!connection) return NextResponse.json({ error: "Reconnect Meta first" }, { status: 400 });
    try {
      const pageToken = await fetchPageAccessToken(decryptToken(connection.access_token_encrypted), source.meta_page_id);
      await subscribePageToLeadgen(pageToken, source.meta_page_id);
      return NextResponse.json({ ok: true, subscribed: true });
    } catch (error) {
      await logServerError({ message: error instanceof Error ? error.message : "Meta Page subscription failed" }, `settings.meta-page-subscribe:${source.meta_page_id}`, { userId: user.id, userEmail: user.email });
      return NextResponse.json({ error: "Meta could not subscribe this Page. Confirm Page access, leads_retrieval, pages_show_list, pages_manage_metadata, and Leads Access." }, { status: 400 });
    }
  }
  const pageId = typeof body?.pageId === "string" ? body.pageId.trim() : "";
  const formId = typeof body?.formId === "string" ? body.formId.trim() : "";
  const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : "";
  if (!/^\d+$/.test(pageId)) return NextResponse.json({ error: "Enter the numeric Facebook Page ID" }, { status: 400 });
  if (formId && !/^\d+$/.test(formId)) return NextResponse.json({ error: "The Form ID must be numeric" }, { status: 400 });

  const service = createServiceClient();
  const { data: business } = await service.from("businesses").select("id").eq("id", businessId).eq("coach_id", user.id).eq("is_active", true).maybeSingle();
  if (!business) return NextResponse.json({ error: "Choose one of your businesses" }, { status: 400 });
  const { data: connection } = await service.from("meta_connections").select("id,access_token_encrypted").eq("coach_id", user.id).eq("status", "active").maybeSingle();
  if (!connection) return NextResponse.json({ error: "Connect Meta first" }, { status: 400 });
  const record = {
    coach_id: user.id,
    connection_id: connection.id,
    business_id: business.id,
    meta_page_id: pageId,
    page_name: typeof body?.pageName === "string" ? body.pageName.trim() || null : null,
    meta_form_id: formId || null,
    meta_ad_account_id: typeof body?.adAccountId === "string" ? body.adAccountId.trim().replace(/^act_/, "") || null : null,
    form_name: typeof body?.formName === "string" ? body.formName.trim() || null : null,
    consent_context: { purpose: "Contact and qualify a website-project inquiry", marketing_consent: false },
    enabled: true,
  };
  let currentQuery = service.from("meta_lead_sources").select("id").eq("coach_id", user.id).eq("meta_page_id", pageId);
  currentQuery = formId ? currentQuery.eq("meta_form_id", formId) : currentQuery.is("meta_form_id", null);
  const { data: current } = await currentQuery.maybeSingle();
  const query = current
    ? service.from("meta_lead_sources").update(record).eq("id", current.id)
    : service.from("meta_lead_sources").insert(record);
  const { error } = await query;
  if (error) {
    await logServerError(error, `settings.meta-lead-source:${pageId}:${formId || "all"}`, { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Couldn't save that Page/form mapping" }, { status: 500 });
  }
  try {
    const pageToken = await fetchPageAccessToken(decryptToken(connection.access_token_encrypted), pageId);
    await subscribePageToLeadgen(pageToken, pageId);
    return NextResponse.json({ ok: true, subscribed: true });
  } catch (subscriptionError) {
    await logServerError({ message: subscriptionError instanceof Error ? subscriptionError.message : "Meta Page subscription failed" }, `settings.meta-page-subscribe:${pageId}`, { userId: user.id, userEmail: user.email });
    return NextResponse.json({ ok: true, subscribed: false, warning: "Mapping saved, but Meta did not confirm the Page webhook subscription. Check Page permissions and Leads Access." });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing source ID" }, { status: 400 });
  const service = createServiceClient();
  const { error } = await service.from("meta_lead_sources").delete().eq("id", id).eq("coach_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't remove that mapping" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
