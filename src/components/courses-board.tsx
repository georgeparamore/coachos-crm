"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NavIcon } from "@/components/nav-icon";
import { CourseFormModal } from "@/components/course-form-modal";
import { LessonFormModal } from "@/components/lesson-form-modal";
import { useErrorToast } from "@/components/error-toast-provider";
import {
  COURSE_STATUS_BADGE,
  COURSE_STATUS_LABEL,
  type Course,
  type CourseInput,
  type CourseModule,
  type Lesson,
  type LessonInput,
} from "@/lib/courses";

export function CoursesBoard({
  initialCourses,
  initialModulesByCourse,
  initialLessonsByModule,
  coachId,
}: {
  initialCourses: Course[];
  initialModulesByCourse: Record<string, CourseModule>;
  initialLessonsByModule: Record<string, Lesson[]>;
  coachId: string;
}) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [courses, setCourses] = useState(initialCourses);
  const [modulesByCourse, setModulesByCourse] = useState(initialModulesByCourse);
  const [lessonsByModule, setLessonsByModule] = useState(initialLessonsByModule);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null | undefined>(undefined);
  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);

  async function ensureModule(courseId: string): Promise<CourseModule> {
    const existing = modulesByCourse[courseId];
    if (existing) return existing;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("course_modules")
      .insert({ course_id: courseId, title: "Lessons", position: 0 })
      .select()
      .single();
    if (error) throw error;
    setModulesByCourse((prev) => ({ ...prev, [courseId]: data as CourseModule }));
    return data as CourseModule;
  }

  async function handleSaveCourse(input: CourseInput) {
    const supabase = createClient();

    if (editingCourse) {
      const { data, error } = await supabase
        .from("courses")
        .update(input)
        .eq("id", editingCourse.id)
        .select()
        .single();
      if (error) throw error;
      setCourses((prev) => prev.map((c) => (c.id === data.id ? (data as Course) : c)));
    } else {
      const { data, error } = await supabase
        .from("courses")
        .insert({ ...input, coach_id: coachId })
        .select()
        .single();
      if (error) throw error;
      setCourses((prev) => [data as Course, ...prev]);
      await ensureModule(data.id);
    }

    setEditingCourse(undefined);
    router.refresh();
  }

  async function handleDeleteCourse() {
    if (!editingCourse) return;
    const supabase = createClient();
    const { error } = await supabase.from("courses").delete().eq("id", editingCourse.id);
    if (error) throw error;
    setCourses((prev) => prev.filter((c) => c.id !== editingCourse.id));
    setEditingCourse(undefined);
    router.refresh();
  }

  async function handleAddLesson(courseId: string, input: LessonInput) {
    try {
      const courseModule = await ensureModule(courseId);
      const supabase = createClient();
      const existingLessons = lessonsByModule[courseModule.id] ?? [];
      const { data, error } = await supabase
        .from("lessons")
        .insert({
          module_id: courseModule.id,
          title: input.title,
          description: input.description || null,
          external_video_url: input.external_video_url || null,
          video_status: input.external_video_url ? "ready" : "processing",
          position: existingLessons.length,
        })
        .select()
        .single();
      if (error) throw error;
      setLessonsByModule((prev) => ({
        ...prev,
        [courseModule.id]: [...(prev[courseModule.id] ?? []), data as Lesson],
      }));
      setAddingLessonFor(null);
      router.refresh();
    } catch (err) {
      showError(err, "courses.lesson-save");
    }
  }

  async function handleDeleteLesson(moduleId: string, lessonId: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (error) throw error;
      setLessonsByModule((prev) => ({
        ...prev,
        [moduleId]: (prev[moduleId] ?? []).filter((l) => l.id !== lessonId),
      }));
      router.refresh();
    } catch (err) {
      showError(err, "courses.lesson-delete");
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="page-sub">
          {courses.length} course{courses.length === 1 ? "" : "s"}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditingCourse(null)}>
          <NavIcon name="plus" /> New course
        </button>
      </div>

      {courses.length === 0 && (
        <div className="empty-state">
          <p>No courses yet — create one to start building out your curriculum.</p>
        </div>
      )}

      {courses.map((course) => {
        const expanded = expandedId === course.id;
        const courseModule = modulesByCourse[course.id];
        const lessons = courseModule ? (lessonsByModule[courseModule.id] ?? []) : [];

        return (
          <div key={course.id} className="card">
            <div className="card-title-row">
              <div>
                <span className={`badge ${COURSE_STATUS_BADGE[course.status]}`} style={{ marginBottom: 6 }}>
                  {COURSE_STATUS_LABEL[course.status]}
                </span>
                <div className="name" style={{ fontSize: 16, marginTop: 4 }}>
                  {course.title}
                </div>
                {course.description && <div className="sub">{course.description}</div>}
                <div className="mini-stat-label">
                  {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setExpandedId(expanded ? null : course.id)}>
                  {expanded ? "Hide lessons" : "Manage lessons"}
                </button>
                <button className="btn btn-sm" onClick={() => setEditingCourse(course)}>
                  Edit
                </button>
              </div>
            </div>

            {expanded && (
              <div>
                {lessons.map((lesson, i) => (
                  <div key={lesson.id} className="list-row">
                    <div className="list-row-left">
                      <NavIcon name="video" />
                      <div>
                        <span className="name">
                          {i + 1}. {lesson.title}
                        </span>
                        {lesson.description && <div className="sub">{lesson.description}</div>}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => courseModule && handleDeleteLesson(courseModule.id, lesson.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {lessons.length === 0 && <p className="sub">No lessons yet.</p>}
                <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setAddingLessonFor(course.id)}>
                  <NavIcon name="plus" /> Add lesson
                </button>
              </div>
            )}
          </div>
        );
      })}

      {editingCourse !== undefined && (
        <CourseFormModal
          course={editingCourse}
          onClose={() => setEditingCourse(undefined)}
          onSave={handleSaveCourse}
          onDelete={editingCourse ? handleDeleteCourse : undefined}
        />
      )}

      {addingLessonFor && (
        <LessonFormModal
          onClose={() => setAddingLessonFor(null)}
          onSave={(input) => handleAddLesson(addingLessonFor, input)}
        />
      )}
    </div>
  );
}
