"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useErrorToast } from "@/components/error-toast-provider";
import { toYouTubeEmbedUrl } from "@/lib/youtube";
import type { Course, CourseModule, Lesson } from "@/lib/courses";

export function ClassroomBoard({
  courses,
  modulesByCourse,
  lessonsByModule,
  enrollmentIdByCourse,
  completedLessonIds,
}: {
  courses: Course[];
  modulesByCourse: Record<string, CourseModule>;
  lessonsByModule: Record<string, Lesson[]>;
  enrollmentIdByCourse: Record<string, string>;
  completedLessonIds: string[];
}) {
  const { showError } = useErrorToast();
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(courses[0]?.id ?? null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(new Set(completedLessonIds));
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleComplete(lessonId: string, enrollmentId: string) {
    setSaving(lessonId);
    const isCompleting = !completed.has(lessonId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("lesson_progress").upsert(
        {
          enrollment_id: enrollmentId,
          lesson_id: lessonId,
          progress_percent: isCompleting ? 100 : 0,
          completed_at: isCompleting ? new Date().toISOString() : null,
        },
        { onConflict: "enrollment_id,lesson_id" },
      );
      if (error) throw error;
      setCompleted((prev) => {
        const next = new Set(prev);
        if (isCompleting) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });
    } catch (err) {
      showError(err, "classroom.mark-complete");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      {courses.map((course) => {
        const courseModule = modulesByCourse[course.id];
        const lessons = courseModule ? (lessonsByModule[courseModule.id] ?? []) : [];
        const enrollmentId = enrollmentIdByCourse[course.id];
        const completedCount = lessons.filter((l) => completed.has(l.id)).length;
        const expanded = expandedCourseId === course.id;

        return (
          <div className="card" key={course.id}>
            <div
              className="list-row"
              style={{ cursor: "pointer" }}
              onClick={() => {
                setExpandedCourseId(expanded ? null : course.id);
                setActiveLessonId(null);
              }}
            >
              <div>
                <div className="name">{course.title}</div>
                <div className="sub">
                  {lessons.length} lesson{lessons.length === 1 ? "" : "s"} · {completedCount}/{lessons.length} complete
                </div>
              </div>
              <span className="badge badge-blue">{expanded ? "Hide lessons" : "View lessons"}</span>
            </div>

            {expanded &&
              (lessons.length === 0 ? (
                <div className="empty-state">
                  <p>No lessons yet — check back soon.</p>
                </div>
              ) : (
                lessons.map((lesson) => {
                  const isActive = activeLessonId === lesson.id;
                  const isDone = completed.has(lesson.id);
                  const embedUrl = lesson.external_video_url ? toYouTubeEmbedUrl(lesson.external_video_url) : null;

                  return (
                    <div key={lesson.id}>
                      <div
                        className="list-row"
                        style={{ cursor: "pointer" }}
                        onClick={() => setActiveLessonId(isActive ? null : lesson.id)}
                      >
                        <div>
                          <div className="name">{lesson.title}</div>
                          {lesson.description && <div className="sub">{lesson.description}</div>}
                        </div>
                        <span className={isDone ? "badge badge-green" : "badge badge-amber"}>
                          {isDone ? "Completed" : "Not started"}
                        </span>
                      </div>

                      {isActive && (
                        <div style={{ padding: "0 0 16px" }}>
                          {embedUrl ? (
                            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
                              <iframe
                                src={embedUrl}
                                title={lesson.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: "100%",
                                  border: 0,
                                  borderRadius: "var(--radius)",
                                }}
                              />
                            </div>
                          ) : lesson.external_video_url ? (
                            <div className="notes-box">
                              That video link isn&apos;t a recognized YouTube URL —{" "}
                              <a href={lesson.external_video_url} target="_blank" rel="noreferrer">
                                open it directly
                              </a>
                              .
                            </div>
                          ) : (
                            <div className="notes-box">No video attached to this lesson yet.</div>
                          )}

                          <button
                            className="btn btn-sm"
                            style={{ marginTop: 10 }}
                            onClick={() => toggleComplete(lesson.id, enrollmentId)}
                            disabled={saving === lesson.id}
                          >
                            {saving === lesson.id ? "Saving…" : isDone ? "Mark as not started" : "Mark complete"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
          </div>
        );
      })}
    </div>
  );
}
