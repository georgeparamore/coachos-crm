import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const { data: business } = await service
    .from("businesses")
    .select("id,name,is_default")
    .eq("id", id)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!business) return Response.json({ error: "Business not found" }, { status: 404 });
  if (business.is_default) {
    return Response.json({ error: "Choose another business as the default before deleting this one." }, { status: 409 });
  }

  const dependencyChecks = await Promise.all([
    service.from("leads").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("client_invites").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("coach_client_memberships").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("courses").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("enrollments").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("meta_lead_sources").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("discovery_call_integrations").select("id", { count: "exact", head: true }).eq("business_id", id),
    service.from("discovery_calls").select("id", { count: "exact", head: true }).eq("business_id", id),
  ]);

  const linkedRecords = dependencyChecks.reduce((total, result) => total + (result.count ?? 0), 0);
  if (linkedRecords > 0) {
    return Response.json({
      error: `${business.name} still has ${linkedRecords} linked record${linkedRecords === 1 ? "" : "s"}. Move or remove those records before deleting the business.`,
    }, { status: 409 });
  }

  const { error } = await service.from("businesses").delete().eq("id", id).eq("coach_id", user.id);
  if (error) {
    const message = error.code === "23503"
      ? "This business still has linked CRM data and cannot be deleted yet."
      : "Could not delete that business.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
