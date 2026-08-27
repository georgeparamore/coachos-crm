import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") return Response.json({ error: "Only a coach can configure Zoom" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const businessId = typeof body?.businessId === "string" ? body.businessId : "";
  const zoomAccountId = typeof body?.zoomAccountId === "string" ? body.zoomAccountId.trim() : "";
  const hostEmail = typeof body?.hostEmail === "string" ? body.hostEmail.trim().toLowerCase() : "";
  if (!businessId || !zoomAccountId) return Response.json({ error: "Business and Zoom Account ID are required" }, { status: 400 });
  const { data: business } = await supabase.from("businesses").select("id").eq("id", businessId).eq("coach_id", user.id).eq("is_active", true).maybeSingle();
  if (!business) return Response.json({ error: "Choose one of your businesses" }, { status: 400 });

  const { data: current } = await supabase.from("discovery_call_integrations").select("id").eq("coach_id", user.id).maybeSingle();
  const record = { coach_id: user.id, business_id: businessId, zoom_account_id: zoomAccountId, host_email: hostEmail || null, enabled: true };
  const query = current
    ? supabase.from("discovery_call_integrations").update(record).eq("id", current.id)
    : supabase.from("discovery_call_integrations").insert(record);
  const { error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

