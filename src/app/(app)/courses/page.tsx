import { createClient } from "@/lib/supabase/server";
import { CoursesBoard } from "@/components/courses-board";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { Course, CourseModule, Lesson } from "@/lib/courses";

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

  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: modules, error: modulesError } =
    courseIds.length > 0
      ? await supabase.from("course_modules").select("*").in("course_id", courseIds).order("position", { ascending: true })
      : { data: [] as CourseModule[], error: null };

  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: lessons, error: lessonsError } =
    moduleIds.length > 0
      ? await supabase.from("lessons").select("*").in("module_id", moduleIds).order("position", { ascending: true })
      : { data: [] as Lesson[], error: null };

  const queryErrors = [coursesError, modulesError, lessonsError].filter(Boolean);
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "courses.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  // One module per course today (the UI treats lessons as flat per-course,
  // matching the design reference) — map course_id -> its single module.
  const modulesByCourse: Record<string, CourseModule> = {};
  for (const m of (modules as CourseModule[] | null) ?? []) {
    if (!modulesByCourse[m.course_id]) modulesByCourse[m.course_id] = m;
  }

  const lessonsByModule: Record<string, Lesson[]> = {};
  for (const l of (lessons as Lesson[] | null) ?? []) {
    (lessonsByModule[l.module_id] ??= []).push(l);
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
        coachId={user!.id}
        initialCreate={createNew === "1"}
      />
    </div>
  );
}
