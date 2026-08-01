import { AdminOverview } from "@/components/community-demo/admin-overview";

export default function AdminOverviewPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Admin overview</div>
          <div className="page-sub">A snapshot of your courses, students, and pipeline.</div>
        </div>
      </div>
      <AdminOverview />
    </div>
  );
}
