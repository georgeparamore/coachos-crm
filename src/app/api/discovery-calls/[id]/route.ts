import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDiscoveryCall } from "@/lib/discovery-call-processing";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: call } = await supabase.from("discovery_calls").select("id,business_id").eq("id", id).eq("coach_id", user.id).maybeSingle();
  if (!call) return Response.json({ error: "Discovery call not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const leadId = body?.leadId === null ? null : typeof body?.leadId === "string" ? body.leadId : undefined;
  const clientId = body?.clientId === null ? null : typeof body?.clientId === "string" ? body.clientId : undefined;
  const update: { lead_id?: string | null; client_id?: string | null } = {};
  if (leadId !== undefined) {
    if (leadId) {
      const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("coach_id", user.id).eq("business_id", call.business_id).maybeSingle();
      if (!lead) return Response.json({ error: "Choose a lead from the same business" }, { status: 400 });
    }
    update.lead_id = leadId;
  }
  if (clientId !== undefined) update.client_id = clientId;
  const { error } = await supabase.from("discovery_calls").update(update).eq("id", id).eq("coach_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: call } = await supabase.from("discovery_calls").select("id").eq("id", id).eq("coach_id", user.id).maybeSingle();
  if (!call) return Response.json({ error: "Discovery call not found" }, { status: 404 });
  await supabase.from("discovery_calls").update({ status: "queued", last_error: null }).eq("id", id);
  after(() => processDiscoveryCall(id));
  return Response.json({ ok: true });
}

