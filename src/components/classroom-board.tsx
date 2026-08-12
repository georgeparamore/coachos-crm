"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useErrorToast } from "@/components/error-toast-provider";
import { NavIcon } from "@/components/nav-icon";
import { toYouTubeEmbedUrl } from "@/lib/youtube";
import type { Course, CourseModule, Lesson } from "@/lib/courses";

export function ClassroomBoard({ courses, modulesByCourse, lessonsByModule, enrollmentIdByCourse, completedLessonIds }: {
  courses: Course[];
  modulesByCourse: Record<string, CourseModule[]>;
  lessonsByModule: Record<string, Lesson[]>;
  enrollmentIdByCourse: Record<string, string>;
  completedLessonIds: string[];
}) {
  const { showError } = useErrorToast();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [completed, setCompleted] = useState(() => new Set(completedLessonIds));
  const [saving, setSaving] = useState<string | null>(null);

  const modules = useMemo(() => modulesByCourse[courseId] ?? [], [courseId, modulesByCourse]);
  const courseLessons = useMemo(() => modules.flatMap((module) => lessonsByModule[module.id] ?? []), [lessonsByModule, modules]);
  const firstIncomplete = courseLessons.find((lesson) => !completed.has(lesson.id)) ?? courseLessons[0];
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const activeLesson = courseLessons.find((lesson) => lesson.id === activeLessonId) ?? firstIncomplete ?? null;
  const activeCourse = courses.find((course) => course.id === courseId) ?? courses[0];
  const completedCount = courseLessons.filter((lesson) => completed.has(lesson.id)).length;
  const percent = courseLessons.length ? Math.round((completedCount / courseLessons.length) * 100) : 0;

  function selectCourse(nextId: string) { setCourseId(nextId); setActiveLessonId(null); }

  async function toggleComplete(lessonId: string) {
    const enrollmentId = enrollmentIdByCourse[courseId];
    if (!enrollmentId) return;
    setSaving(lessonId);
    const isCompleting = !completed.has(lessonId);
    try {
      const { error } = await createClient().from("lesson_progress").upsert({ enrollment_id: enrollmentId, lesson_id: lessonId, progress_percent: isCompleting ? 100 : 0, completed_at: isCompleting ? new Date().toISOString() : null }, { onConflict: "enrollment_id,lesson_id" });
      if (error) throw error;
      setCompleted((current) => { const next = new Set(current); if (isCompleting) next.add(lessonId); else next.delete(lessonId); return next; });
      if (isCompleting) {
        const currentIndex = courseLessons.findIndex((lesson) => lesson.id === lessonId);
        const nextLesson = courseLessons.slice(currentIndex + 1).find((lesson) => !completed.has(lesson.id));
        if (nextLesson) setActiveLessonId(nextLesson.id);
      }
    } catch (error) { showError(error, "classroom.mark-complete"); } finally { setSaving(null); }
  }

  const embedUrl = activeLesson?.external_video_url ? toYouTubeEmbedUrl(activeLesson.external_video_url) : null;
  return <div className="classroom-shell">
    <aside className="classroom-sidebar">
      <div className="classroom-course-switcher"><span className="eyebrow">My programs</span>{courses.map((course) => <button className={course.id === courseId ? "active" : ""} key={course.id} onClick={() => selectCourse(course.id)}><span>{course.title}</span><small>{(modulesByCourse[course.id] ?? []).flatMap((module) => lessonsByModule[module.id] ?? []).filter((lesson) => completed.has(lesson.id)).length}/{(modulesByCourse[course.id] ?? []).flatMap((module) => lessonsByModule[module.id] ?? []).length}</small></button>)}</div>
      <div className="classroom-outline"><div className="classroom-progress"><div><span>Progress</span><strong>{percent}%</strong></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div></div>{modules.map((module, moduleIndex) => <section key={module.id}><header><span>{String(moduleIndex + 1).padStart(2, "0")}</span><strong>{module.title}</strong></header>{(lessonsByModule[module.id] ?? []).map((lesson) => <button className={`${activeLesson?.id === lesson.id ? "active" : ""}${completed.has(lesson.id) ? " complete" : ""}`} key={lesson.id} onClick={() => setActiveLessonId(lesson.id)}><span className="classroom-check">{completed.has(lesson.id) ? "✓" : ""}</span><span>{lesson.title}</span></button>)}</section>)}</div>
    </aside>
    <main className="classroom-player">
      {activeLesson ? <>
        <div className="classroom-player-head"><div><span className="eyebrow">{activeCourse?.title}</span><h1>{activeLesson.title}</h1></div><span>{completed.has(activeLesson.id) ? "Completed" : "In progress"}</span></div>
        <div className="classroom-media">{embedUrl ? <iframe src={embedUrl} title={activeLesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : activeLesson.external_video_url ? <a href={activeLesson.external_video_url} target="_blank" rel="noreferrer"><NavIcon name="link" /> Open lesson resource</a> : <div><NavIcon name="book-open" /><span>Reading lesson</span></div>}</div>
        <div className="classroom-content card"><div><span className="eyebrow">Lesson notes</span><p>{activeLesson.description || "Your coach hasn’t added notes to this lesson yet."}</p></div><button className={`btn ${completed.has(activeLesson.id) ? "" : "btn-accent"}`} disabled={saving === activeLesson.id} onClick={() => toggleComplete(activeLesson.id)}>{saving === activeLesson.id ? "Saving…" : completed.has(activeLesson.id) ? "Mark incomplete" : "Complete & continue"}</button></div>
      </> : <div className="card classroom-no-lesson"><NavIcon name="book-open" /><h2>This program is being prepared</h2><p>Your coach will add lessons here soon.</p></div>}
    </main>
  </div>;
}
