import { LeadsTable } from "@/components/community-demo/leads-table";

export default function AdminLeadsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">Everyone who&apos;s shown interest but hasn&apos;t joined yet.</div>
        </div>
      </div>
      <LeadsTable />
    </div>
  );
}
