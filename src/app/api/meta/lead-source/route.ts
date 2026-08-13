import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") return NextResponse.json({ error: "Only a coach can configure lead intake" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const pageId = typeof body?.pageId === "string" ? body.pageId.trim() : "";
  const formId = typeof body?.formId === "string" ? body.formId.trim() : "";
  if (!/^\d+$/.test(pageId)) return NextResponse.json({ error: "Enter the numeric Facebook Page ID" }, { status: 400 });
  if (formId && !/^\d+$/.test(formId)) return NextResponse.json({ error: "The Form ID must be numeric" }, { status: 400 });

  const service = createServiceClient();
  const { data: connection } = await service.from("meta_connections").select("id").eq("coach_id", user.id).eq("status", "active").maybeSingle();
  if (!connection) return NextResponse.json({ error: "Connect Meta first" }, { status: 400 });
  const record = {
    coach_id: user.id,
    connection_id: connection.id,
    meta_page_id: pageId,
    page_name: typeof body?.pageName === "string" ? body.pageName.trim() || null : null,
    meta_form_id: formId || null,
    form_name: typeof body?.formName === "string" ? body.formName.trim() || null : null,
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
  return NextResponse.json({ ok: true });
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
