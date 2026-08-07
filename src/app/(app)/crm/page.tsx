import { createClient } from "@/lib/supabase/server";
import { CrmBoard } from "@/components/crm-board";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { Lead } from "@/lib/leads";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead: initialLeadId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("coach_id", user!.id)
    .order("created_at", { ascending: false });

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

      <CrmBoard initialLeads={(leads as Lead[]) ?? []} coachId={user!.id} initialLeadId={initialLeadId} />
    </div>
  );
}
