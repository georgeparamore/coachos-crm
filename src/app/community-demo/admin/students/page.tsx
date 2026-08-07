import { StudentProgressTable } from "@/components/community-demo/student-progress-table";

export default function AdminStudentsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Student progress</div>
          <div className="page-sub">Track completion across every student in the community.</div>
        </div>
      </div>
      <StudentProgressTable />
    </div>
  );
}
