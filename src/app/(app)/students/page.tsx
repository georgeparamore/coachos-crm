import { createClient } from "@/lib/supabase/server";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";

type Enrollment = {
  id: string;
  course_id: string;
  client_id: string;
  enrolled_at: string;
};

export default async function StudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [coursesRes, enrollmentsRes] = await Promise.all([
    supabase.from("courses").select("id, title").eq("coach_id", user!.id),
    supabase
      .from("enrollments")
      .select("id, course_id, client_id, enrolled_at")
      .eq("coach_id", user!.id)
      .order("enrolled_at", { ascending: false }),
  ]);

  const { data: courses } = coursesRes;
  const { data: enrollments } = enrollmentsRes;
  const allEnrollments = (enrollments as Enrollment[] | null) ?? [];
  const courseIds = (courses ?? []).map((c) => c.id);

  const [modulesRes, clientsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("course_modules").select("id, course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { id: string; course_id: string }[], error: null }),
    allEnrollments.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .in(
            "id",
            allEnrollments.map((e) => e.client_id),
          )
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[], error: null }),
  ]);

  const { data: modules } = modulesRes;
  const { data: clients } = clientsRes;
  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: lessons, error: lessonsError } =
    moduleIds.length > 0
      ? await supabase.from("lessons").select("id, module_id").in("module_id", moduleIds)
      : { data: [] as { id: string; module_id: string }[], error: null };

  const enrollmentIds = allEnrollments.map((e) => e.id);
  const { data: progress, error: progressError } =
    enrollmentIds.length > 0
      ? await supabase
          .from("lesson_progress")
          .select("enrollment_id, completed_at")
          .in("enrollment_id", enrollmentIds)
      : { data: [] as { enrollment_id: string; completed_at: string | null }[], error: null };

  const queryErrors = [coursesRes.error, enrollmentsRes.error, modulesRes.error, clientsRes.error, lessonsError, progressError].filter(
    Boolean,
  );
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "students.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  const courseTitleById = new Map((courses ?? []).map((c) => [c.id, c.title]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  const moduleCourseById = new Map((modules ?? []).map((m) => [m.id, m.course_id]));
  const lessonCountByCourse = new Map<string, number>();
  for (const lesson of modules ? (lessons ?? []) : []) {
    const courseId = moduleCourseById.get(lesson.module_id);
    if (!courseId) continue;
    lessonCountByCourse.set(courseId, (lessonCountByCourse.get(courseId) ?? 0) + 1);
  }

  const completedCountByEnrollment = new Map<string, number>();
  for (const row of progress ?? []) {
    if (!row.completed_at) continue;
    completedCountByEnrollment.set(row.enrollment_id, (completedCountByEnrollment.get(row.enrollment_id) ?? 0) + 1);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Student progress</div>
          <div className="page-sub">Track completion across every student in your courses</div>
        </div>
      </div>

      {queryErrors.length > 0 && <DataLoadError what="student progress" />}

      {allEnrollments.length === 0 ? (
        <div className="empty-state">
          <p>
            No students enrolled yet. Enrollment is invite-based — once a client account accepts an
            invitation and is enrolled in a course, their progress will show up here.
          </p>
        </div>
      ) : (
        <div className="card">
          {allEnrollments.map((enrollment) => {
            const client = clientById.get(enrollment.client_id);
            const totalLessons = lessonCountByCourse.get(enrollment.course_id) ?? 0;
            const completed = completedCountByEnrollment.get(enrollment.id) ?? 0;
            const pct = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

            return (
              <div className="list-row" key={enrollment.id}>
                <div>
                  <div className="name">{client?.full_name || client?.email || "Unknown client"}</div>
                  <div className="sub">{courseTitleById.get(enrollment.course_id) ?? "Unknown course"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="name">{pct}%</div>
                  <div className="sub">
                    {completed} of {totalLessons} lessons
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
