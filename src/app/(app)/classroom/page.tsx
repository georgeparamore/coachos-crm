import { createClient } from "@/lib/supabase/server";
import { ClassroomBoard } from "@/components/classroom-board";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { Course, CourseModule, Lesson } from "@/lib/courses";

export default async function ClassroomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("id, course_id")
    .eq("client_id", user!.id);

  const courseIds = (enrollments ?? []).map((e) => e.course_id);

  const [coursesRes, modulesRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("courses").select("*").in("id", courseIds)
      : Promise.resolve({ data: [] as Course[], error: null }),
    courseIds.length > 0
      ? supabase.from("course_modules").select("*").in("course_id", courseIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] as CourseModule[], error: null }),
  ]);

  const { data: courses, error: coursesError } = coursesRes;
  const { data: modules, error: modulesError } = modulesRes;
  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: lessons, error: lessonsError } =
    moduleIds.length > 0
      ? await supabase.from("lessons").select("*").in("module_id", moduleIds).order("position", { ascending: true })
      : { data: [] as Lesson[], error: null };

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const { data: progress, error: progressError } =
    enrollmentIds.length > 0
      ? await supabase
          .from("lesson_progress")
          .select("enrollment_id, lesson_id, completed_at, progress_percent")
          .in("enrollment_id", enrollmentIds)
      : { data: [] as { enrollment_id: string; lesson_id: string; completed_at: string | null; progress_percent: number }[], error: null };

  const queryErrors = [enrollmentsError, coursesError, modulesError, lessonsError, progressError].filter(Boolean);
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "classroom.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  const enrollmentIdByCourse: Record<string, string> = {};
  for (const e of enrollments ?? []) enrollmentIdByCourse[e.course_id] = e.id;

  const modulesByCourse: Record<string, CourseModule[]> = {};
  for (const m of (modules as CourseModule[] | null) ?? []) {
    (modulesByCourse[m.course_id] ??= []).push(m);
  }

  const lessonsByModule: Record<string, Lesson[]> = {};
  for (const l of (lessons as Lesson[] | null) ?? []) {
    (lessonsByModule[l.module_id] ??= []).push(l);
  }

  const completedLessonIds = (progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">My courses</div>
          <div className="page-sub">Pick up where you left off</div>
        </div>
      </div>

      {queryErrors.length > 0 && <DataLoadError what="your courses" />}

      {(courses ?? []).length === 0 ? (
        <div className="empty-state">
          <p>You&apos;re not enrolled in any courses yet — your coach will enroll you once one&apos;s ready.</p>
        </div>
      ) : (
        <ClassroomBoard
          courses={(courses as Course[]) ?? []}
          modulesByCourse={modulesByCourse}
          lessonsByModule={lessonsByModule}
          enrollmentIdByCourse={enrollmentIdByCourse}
          completedLessonIds={completedLessonIds}
        />
      )}
    </div>
  );
}
