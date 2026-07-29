import { LeadsDirectory } from "@/components/realestate-demo/leads-directory";

export default function LeadsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Leads</div>
          <div className="page-sub">Everything beyond today — search, filter, and browse the full pipeline.</div>
        </div>
      </div>
      <LeadsDirectory />
    </div>
  );
}
