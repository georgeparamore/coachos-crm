import { createClient } from "@/lib/supabase/server";
import { CoursesBoard } from "@/components/courses-board";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { Course, CourseModule, Lesson } from "@/lib/courses";
import type { Business } from "@/lib/businesses";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: createNew } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("*")
    .eq("coach_id", user!.id)
    .order("created_at", { ascending: false });
  const { data: businesses } = await supabase.from("businesses").select("*").eq("coach_id", user!.id).eq("is_active", true).order("is_default", { ascending: false });

  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: modules, error: modulesError } =
    courseIds.length > 0
      ? await supabase.from("course_modules").select("*").in("course_id", courseIds).order("position", { ascending: true })
      : { data: [] as CourseModule[], error: null };

  const moduleIds = (modules ?? []).map((m) => m.id);

  const [lessonsResult, enrollmentsResult, membershipsResult] = await Promise.all([
    moduleIds.length > 0
      ? supabase.from("lessons").select("*").in("module_id", moduleIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] as Lesson[], error: null }),
    courseIds.length > 0
      ? supabase.from("enrollments").select("id, course_id, client_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { id: string; course_id: string; client_id: string }[], error: null }),
    supabase.from("coach_client_memberships").select("client_id").eq("coach_id", user!.id).eq("status", "active"),
  ]);
  const { data: lessons, error: lessonsError } = lessonsResult;

  const clientIds = (membershipsResult.data ?? []).map((membership) => membership.client_id);
  const profilesResult = clientIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", clientIds).order("full_name")
    : { data: [] as { id: string; full_name: string | null; email: string }[], error: null };
  const enrollmentIds = (enrollmentsResult.data ?? []).map((enrollment) => enrollment.id);
  const progressResult = enrollmentIds.length
    ? await supabase.from("lesson_progress").select("enrollment_id, completed_at").in("enrollment_id", enrollmentIds).not("completed_at", "is", null)
    : { data: [] as { enrollment_id: string; completed_at: string | null }[], error: null };

  const queryErrors = [coursesError, modulesError, lessonsError, enrollmentsResult.error, membershipsResult.error, profilesResult.error, progressResult.error].filter(Boolean);
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "courses.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  const modulesByCourse: Record<string, CourseModule[]> = {};
  for (const m of (modules as CourseModule[] | null) ?? []) {
    (modulesByCourse[m.course_id] ??= []).push(m);
  }

  const lessonsByModule: Record<string, Lesson[]> = {};
  for (const l of (lessons as Lesson[] | null) ?? []) {
    (lessonsByModule[l.module_id] ??= []).push(l);
  }

  const enrollmentCountByCourse: Record<string, number> = {};
  const enrolledClientIdsByCourse: Record<string, string[]> = {};
  const enrollmentProgressByCourseClient: Record<string, number> = {};
  const lessonCountByCourse: Record<string, number> = {};
  for (const courseModule of (modules as CourseModule[] | null) ?? []) lessonCountByCourse[courseModule.course_id] = (lessonCountByCourse[courseModule.course_id] ?? 0) + (lessonsByModule[courseModule.id]?.length ?? 0);
  const completedByEnrollment: Record<string, number> = {};
  for (const row of progressResult.data ?? []) completedByEnrollment[row.enrollment_id] = (completedByEnrollment[row.enrollment_id] ?? 0) + 1;
  for (const enrollment of enrollmentsResult.data ?? []) {
    enrollmentCountByCourse[enrollment.course_id] = (enrollmentCountByCourse[enrollment.course_id] ?? 0) + 1;
    (enrolledClientIdsByCourse[enrollment.course_id] ??= []).push(enrollment.client_id);
    const total = lessonCountByCourse[enrollment.course_id] ?? 0;
    enrollmentProgressByCourseClient[`${enrollment.course_id}:${enrollment.client_id}`] = total ? Math.round(((completedByEnrollment[enrollment.id] ?? 0) / total) * 100) : 0;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Courses &amp; programs</div>
          <div className="page-sub">Upload your content, track student progress</div>
        </div>
      </div>

      {queryErrors.length > 0 && <DataLoadError what="your courses" />}

      <CoursesBoard
        initialCourses={(courses as Course[]) ?? []}
        initialModulesByCourse={modulesByCourse}
        initialLessonsByModule={lessonsByModule}
        enrollmentCountByCourse={enrollmentCountByCourse}
        enrolledClientIdsByCourse={enrolledClientIdsByCourse}
        clients={profilesResult.data ?? []}
        businesses={(businesses as Business[]) ?? []}
        enrollmentProgressByCourseClient={enrollmentProgressByCourseClient}
        coachId={user!.id}
        initialCreate={createNew === "1"}
      />
    </div>
  );
}
