"use client";

import Link from "next/link";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo } from "@/lib/community-demo-store";

export function ClassroomGrid() {
  const { courses, courseProgress } = useCommunityDemo();

  return (
    <div className="cp-course-grid">
      {courses.map((course) => {
        const pct = courseProgress(course);
        return (
          <Link key={course.id} href={`/community-demo/classroom/${course.id}`} className="card cp-course-card">
            <div className={`cp-course-cover cp-swatch-${course.color}`}>
              <NavIcon name="play" />
            </div>
            <div className="badge badge-blue" style={{ marginBottom: 8 }}>
              {course.category}
            </div>
            <div className="cp-lead-name">{course.title}</div>
            <p className="cp-lead-summary">{course.description}</p>
            <div className="mini-stat-label" style={{ marginBottom: 6 }}>
              {course.lessons.length} lessons
            </div>
            <div className="cp-progress-track">
              <div className="cp-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="mini-stat-label" style={{ marginTop: 6 }}>
              {pct}% complete
            </div>
          </Link>
        );
      })}
      {courses.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
          <div className="card-title">No courses yet</div>
          <p className="page-sub">Courses uploaded from the admin panel will show up here.</p>
        </div>
      )}
    </div>
  );
}
