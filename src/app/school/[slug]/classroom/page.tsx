import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { ClassroomBoard } from "@/components/classroom-board";
import { SchoolSignOut } from "@/components/school-sign-out";
import type { Course, CourseModule, Lesson } from "@/lib/courses";

export default async function SchoolClassroomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: school } = await service.from("businesses").select("id, slug, portal_name, portal_tagline, color, portal_enabled").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!school || !school.portal_enabled) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/school/${slug}/login`);
  const { data: membership } = await supabase.from("coach_client_memberships").select("id").eq("business_id", school.id).eq("client_id", user.id).eq("status", "active").maybeSingle();
  if (!membership) redirect(`/school/${slug}/login`);
  const { data: enrollments } = await supabase.from("enrollments").select("id, course_id").eq("business_id", school.id).eq("client_id", user.id);
  const courseIds = (enrollments ?? []).map((row) => row.course_id);
  const { data: courses } = courseIds.length ? await supabase.from("courses").select("*").in("id", courseIds).eq("status", "published") : { data: [] as Course[] };
  const { data: modules } = courseIds.length ? await supabase.from("course_modules").select("*").in("course_id", courseIds).order("position") : { data: [] as CourseModule[] };
  const moduleIds = (modules ?? []).map((row) => row.id);
  const { data: lessons } = moduleIds.length ? await supabase.from("lessons").select("*").in("module_id", moduleIds).order("position") : { data: [] as Lesson[] };
  const enrollmentIds = (enrollments ?? []).map((row) => row.id);
  const { data: progress } = enrollmentIds.length ? await supabase.from("lesson_progress").select("lesson_id, completed_at").in("enrollment_id", enrollmentIds) : { data: [] as { lesson_id: string; completed_at: string | null }[] };
  const modulesByCourse: Record<string, CourseModule[]> = {}; for (const row of modules ?? []) (modulesByCourse[row.course_id] ??= []).push(row as CourseModule);
  const lessonsByModule: Record<string, Lesson[]> = {}; for (const row of lessons ?? []) (lessonsByModule[row.module_id] ??= []).push(row as Lesson);
  const enrollmentIdByCourse = Object.fromEntries((enrollments ?? []).map((row) => [row.course_id, row.id]));
  return <div className="school-portal" style={{ "--school-color": school.color, "--accent": school.color } as React.CSSProperties}>
    <header className="school-header"><div><div className="logo-name">{school.portal_name}</div><div className="sub">Student school</div></div><nav><span className="school-nav-active">Classroom</span><SchoolSignOut slug={slug} /></nav></header>
    <main className="page"><div className="page-header"><div><div className="page-title">My classroom</div><div className="page-sub">{school.portal_tagline}</div></div></div>
      {(courses ?? []).length ? <ClassroomBoard courses={(courses as Course[]) ?? []} modulesByCourse={modulesByCourse} lessonsByModule={lessonsByModule} enrollmentIdByCourse={enrollmentIdByCourse} completedLessonIds={(progress ?? []).filter((row) => row.completed_at).map((row) => row.lesson_id)} /> : <div className="empty-state"><p>No courses are available yet. Your coach will publish them here when they’re ready.</p></div>}
    </main>
  </div>;
}
