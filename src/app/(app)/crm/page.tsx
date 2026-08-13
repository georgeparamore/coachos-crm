import { createClient } from "@/lib/supabase/server";
import { CrmBoard } from "@/components/crm-board";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { Lead } from "@/lib/leads";
import type { Business } from "@/lib/businesses";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; new?: string }>;
}) {
  const { lead: initialLeadId, new: createNew } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [leadsResult, businessesResult] = await Promise.all([
    supabase.from("leads").select("*").eq("coach_id", user!.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("businesses").select("*").eq("coach_id", user!.id).eq("is_active", true).order("is_default", { ascending: false }).order("name"),
  ]);
  const { data: leads, error } = leadsResult;

  if (error) await logServerError(error, "crm.load", { userId: user!.id, userEmail: user!.email });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">Track every lead from first touch to signed client</div>
        </div>
      </div>

      {error && <DataLoadError what="your leads" />}

      <CrmBoard initialLeads={(leads as Lead[]) ?? []} businesses={(businessesResult.data as Business[]) ?? []} coachId={user!.id} initialLeadId={initialLeadId} initialCreate={createNew === "1"} />
    </div>
  );
}
