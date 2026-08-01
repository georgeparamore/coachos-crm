import { CourseManager } from "@/components/community-demo/course-manager";

export default function AdminCoursesPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Courses</div>
          <div className="page-sub">Upload lessons and organize what shows up in the classroom.</div>
        </div>
      </div>
      <CourseManager />
    </div>
  );
}
