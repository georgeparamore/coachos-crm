"use client";

import { useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { CourseFormModal } from "@/components/community-demo/course-form-modal";
import { LessonFormModal } from "@/components/community-demo/lesson-form-modal";

export function CourseManager() {
  const { courses, addCourse, deleteCourse, addLesson, deleteLesson } = useCommunityDemo();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="page-sub">{courses.length} courses published to the classroom.</div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddingCourse(true)}>
          + New course
        </button>
      </div>

      {courses.map((course) => {
        const expanded = expandedId === course.id;
        return (
          <div key={course.id} className="card">
            <div className="card-title-row">
              <div>
                <div className={`badge badge-blue`} style={{ marginBottom: 6 }}>
                  {course.category}
                </div>
                <div className="cp-lead-name">{course.title}</div>
                <div className="mini-stat-label">{course.lessons.length} lessons</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setExpandedId(expanded ? null : course.id)}>
                  {expanded ? "Hide lessons" : "Manage lessons"}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteCourse(course.id)}>
                  Delete
                </button>
              </div>
            </div>

            {expanded && (
              <div>
                {course.lessons.map((lesson, i) => (
                  <div key={lesson.id} className="mini-stat-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <NavIcon name="video" />
                      <span className="mini-stat-value" style={{ fontWeight: 500 }}>
                        {i + 1}. {lesson.title}
                      </span>
                      <span className="mini-stat-label">{lesson.durationMin}m</span>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteLesson(course.id, lesson.id)}>
                      Remove
                    </button>
                  </div>
                ))}
                {course.lessons.length === 0 && <p className="page-sub">No lessons uploaded yet.</p>}
                <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setAddingLessonFor(course.id)}>
                  <NavIcon name="plus" /> Upload lesson
                </button>
              </div>
            )}
          </div>
        );
      })}

      {addingCourse && (
        <CourseFormModal
          onClose={() => setAddingCourse(false)}
          onSubmit={(input) => {
            const course = addCourse(input);
            setAddingCourse(false);
            setExpandedId(course.id);
          }}
        />
      )}

      {addingLessonFor && (
        <LessonFormModal
          courseTitle={courses.find((c) => c.id === addingLessonFor)?.title ?? ""}
          onClose={() => setAddingLessonFor(null)}
          onSubmit={(input) => {
            addLesson(addingLessonFor, input);
            setAddingLessonFor(null);
          }}
        />
      )}
    </div>
  );
}
