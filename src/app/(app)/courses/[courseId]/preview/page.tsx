import Link from "next/link";
import { notFound } from "next/navigation";
import { ClassroomBoard } from "@/components/classroom-board";
import { DataLoadError } from "@/components/data-load-error";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-server-error";
import type { Course, CourseModule, Lesson } from "@/lib/courses";

export default async function CoursePreviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("coach_id", user!.id)
    .maybeSingle();

  if (!course && !courseError) notFound();

  const { data: modules, error: modulesError } = course
    ? await supabase.from("course_modules").select("*").eq("course_id", courseId).order("position", { ascending: true })
    : { data: [] as CourseModule[], error: null };
  const moduleIds = (modules ?? []).map((module) => module.id);
  const { data: lessons, error: lessonsError } = moduleIds.length
    ? await supabase.from("lessons").select("*").in("module_id", moduleIds).order("position", { ascending: true })
    : { data: [] as Lesson[], error: null };

  const queryErrors = [courseError, modulesError, lessonsError].filter(Boolean);
  if (queryErrors.length) {
    await Promise.all(queryErrors.map((error) => logServerError(error, `courses.preview-load:${courseId}`, { userId: user!.id, userEmail: user!.email })));
  }

  if (!course) {
    return <div className="page"><DataLoadError what="this course preview" /></div>;
  }

  const lessonsByModule: Record<string, Lesson[]> = {};
  for (const lesson of (lessons as Lesson[] | null) ?? []) {
    (lessonsByModule[lesson.module_id] ??= []).push(lesson);
  }

  return <div className="page course-preview-page">
    <div className="course-preview-bar">
      <div><span className="eyebrow">Admin preview</span><strong>This is what your clients will see</strong><p>Viewing is read-only and won&apos;t change anyone&apos;s progress.</p></div>
      <Link className="btn btn-primary" href="/courses">Back to editor</Link>
    </div>
    <ClassroomBoard
      courses={[course as Course]}
      modulesByCourse={{ [courseId]: (modules as CourseModule[]) ?? [] }}
      lessonsByModule={lessonsByModule}
      enrollmentIdByCourse={{}}
      completedLessonIds={[]}
      previewMode
    />
  </div>;
}
