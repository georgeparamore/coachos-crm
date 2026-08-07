import { ClassroomGrid } from "@/components/community-demo/classroom-grid";

export default function ClassroomPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Classroom</div>
          <div className="page-sub">Every course you have access to, with your progress tracked automatically.</div>
        </div>
      </div>
      <ClassroomGrid />
    </div>
  );
}
