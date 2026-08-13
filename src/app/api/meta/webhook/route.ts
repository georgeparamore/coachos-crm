import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta/crypto";
import { fetchLead } from "@/lib/meta/client";
import { logServerError } from "@/lib/log-server-error";
import { sendEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const valid = url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === process.env.META_WEBHOOK_VERIFY_TOKEN;
  return new Response(valid ? (url.searchParams.get("hub.challenge") ?? "") : "Invalid verification token", { status: valid ? 200 : 403 });
}

function signatureIsValid(raw: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const supplied = Buffer.from(signature.slice(7));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function answerMap(fieldData: { name: string; values?: string[] }[] = []) {
  return Object.fromEntries(fieldData.map((field) => [field.name, (field.values ?? []).join(", ")]));
}

function first(answers: Record<string, string>, keys: string[]) {
  for (const key of keys) if (answers[key]?.trim()) return answers[key].trim();
  return "";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function processLead(value: Record<string, unknown>) {
  const service = createServiceClient();
  const leadgenId = String(value.leadgen_id ?? "");
  const pageId = String(value.page_id ?? "");
  const formId = value.form_id ? String(value.form_id) : null;
  if (!leadgenId || !pageId) return;

  const { data: existingEvent } = await service.from("meta_lead_webhook_events").select("id,status").eq("meta_leadgen_id", leadgenId).maybeSingle();
  if (existingEvent?.status === "processed" || existingEvent?.status === "duplicate") return;

  const { data: sources } = await service.from("meta_lead_sources").select("*").eq("meta_page_id", pageId).eq("enabled", true);
  const source = (sources ?? []).find((item) => item.meta_form_id === formId) ?? (sources ?? []).find((item) => !item.meta_form_id);
  const baseEvent = { meta_page_id: pageId, meta_form_id: formId, meta_leadgen_id: leadgenId, payload: value };
  if (!source) {
    await service.from("meta_lead_webhook_events").upsert({ ...baseEvent, status: "unmapped", error: "No enabled Page/form mapping" }, { onConflict: "meta_leadgen_id" });
    return;
  }

  const { data: connection } = await service.from("meta_connections").select("access_token_encrypted").eq("id", source.connection_id).eq("status", "active").single();
  try {
    if (!connection?.access_token_encrypted) throw new Error("Meta connection is unavailable");
    const metaLead = await fetchLead(decryptToken(connection.access_token_encrypted), leadgenId);
    const answers = answerMap(metaLead.field_data);
    const email = first(answers, ["email", "work_email"]);
    const phone = first(answers, ["phone_number", "phone"]);
    const fullName = first(answers, ["full_name", "name"]) || [answers.first_name, answers.last_name].filter(Boolean).join(" ") || email || phone || "New Meta lead";
    const customAnswers = Object.entries(answers).filter(([key]) => !["email", "work_email", "phone_number", "phone", "full_name", "name", "first_name", "last_name"].includes(key));
    const notes = customAnswers.length ? `Instant Form answers:\n${customAnswers.map(([key, val]) => `${key.replaceAll("_", " ")}: ${val}`).join("\n")}` : null;
    const details = { platform: "meta", page_id: pageId, page_name: source.page_name, form_id: formId, form_name: source.form_name, ad_id: metaLead.ad_id, ad_name: metaLead.ad_name, adset_id: metaLead.adset_id, adset_name: metaLead.adset_name, campaign_id: metaLead.campaign_id, campaign_name: metaLead.campaign_name, answers };

    const { data: duplicate } = (email || phone) ? await service.from("leads").select("id,external_id").eq("coach_id", source.coach_id).or([email ? `email.ilike.${email}` : "", phone ? `phone.eq.${phone}` : ""].filter(Boolean).join(",")).limit(1).maybeSingle() : { data: null };
    let crmLeadId: string;
    if (duplicate && !duplicate.external_id) {
      const { error } = await service.from("leads").update({ business_id: source.business_id, external_source: "meta", external_id: leadgenId, source: "Meta Lead Ad", source_details: details, notes }).eq("id", duplicate.id);
      if (error) throw error;
      crmLeadId = duplicate.id;
    } else {
      const leadRecord = { coach_id: source.coach_id, business_id: source.business_id, external_source: "meta", external_id: leadgenId, name: fullName, email: email || null, phone: phone || null, source: "Meta Lead Ad", stage: "new", notes, source_details: details };
      const { data: existingLead } = await service.from("leads").select("id").eq("coach_id", source.coach_id).eq("external_source", "meta").eq("external_id", leadgenId).maybeSingle();
      const { data: savedLead, error } = existingLead
        ? await service.from("leads").update(leadRecord).eq("id", existingLead.id).select("id").single()
        : await service.from("leads").insert(leadRecord).select("id").single();
      if (error) throw error;
      crmLeadId = savedLead.id;
    }
    const [{ data: coach }, { data: business }, { data: preferences }] = await Promise.all([
      service.from("profiles").select("email").eq("id", source.coach_id).single(),
      service.from("businesses").select("name").eq("id", source.business_id).single(),
      service.from("notification_preferences").select("email_enabled,event_settings").eq("profile_id", source.coach_id).maybeSingle(),
    ]);
    const notificationPayload = { leadgen_id: leadgenId, lead_id: crmLeadId, name: fullName, email, phone, business_name: business?.name ?? "Business" };
    await service.from("notification_deliveries").insert({ profile_id: source.coach_id, event_type: "new_meta_lead", channel: "in_app", payload: notificationPayload, status: "sent", sent_at: new Date().toISOString(), idempotency_key: `new_meta_lead:${leadgenId}:in_app` });
    const emailAllowed = preferences?.email_enabled !== false && preferences?.event_settings?.new_meta_lead !== false;
    if (coach?.email && emailAllowed) {
      const crmUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://coachos-drab.vercel.app"}/crm?lead=${crmLeadId}`;
      const result = await sendEmail({
        to: coach.email,
        replyTo: email || undefined,
        subject: `New ${business?.name ?? "business"} lead: ${fullName}`,
        html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px"><h2>New lead received</h2><p><strong>${escapeHtml(fullName)}</strong> submitted your ${escapeHtml(source.form_name || "Meta Instant Form")}.</p><p>Business: ${escapeHtml(business?.name ?? "Business")}<br>Email: ${escapeHtml(email || "Not provided")}<br>Phone: ${escapeHtml(phone || "Not provided")}</p><p><a href="${crmUrl}" style="display:inline-block;background:#171717;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none">Open lead in Full Circle CRM</a></p></div>`,
        text: `New lead received: ${fullName}\nBusiness: ${business?.name ?? "Business"}\nEmail: ${email || "Not provided"}\nPhone: ${phone || "Not provided"}\n\nOpen lead: ${crmUrl}`,
      });
      await service.from("notification_deliveries").insert({ profile_id: source.coach_id, event_type: "new_meta_lead", channel: "email", payload: notificationPayload, status: result.sent ? "sent" : "failed", sent_at: result.sent ? new Date().toISOString() : null, failed_at: result.sent ? null : new Date().toISOString(), error: result.error ?? null, attempt_count: 1, idempotency_key: `new_meta_lead:${leadgenId}:email` });
    }
    await service.from("meta_lead_sources").update({ last_received_at: new Date().toISOString() }).eq("id", source.id);
    await service.from("meta_lead_webhook_events").upsert({ ...baseEvent, coach_id: source.coach_id, source_id: source.id, status: duplicate ? "duplicate" : "processed", processed_at: new Date().toISOString(), error: null }, { onConflict: "meta_leadgen_id" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown lead processing error";
    await service.from("meta_lead_webhook_events").upsert({ ...baseEvent, coach_id: source.coach_id, source_id: source.id, status: "failed", error: message }, { onConflict: "meta_leadgen_id" });
    await logServerError({ message }, `meta.webhook.process:${leadgenId}:${pageId}:${formId ?? "unknown"}`);
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!signatureIsValid(raw, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const body = JSON.parse(raw);
  for (const entry of body.entry ?? []) for (const change of entry.changes ?? []) if (change.field === "leadgen") await processLead(change.value ?? {});
  return NextResponse.json({ received: true });
}
