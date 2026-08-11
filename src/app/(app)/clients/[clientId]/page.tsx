import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientNotes, type ClientNote } from "@/components/client-notes";
import { EnrollClientButton } from "@/components/enroll-client-button";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";

type ActivityItem = { id: string; date: string; label: string; detail: string; tone: string };

export default async function ClientProfilePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const membershipRes = await supabase
    .from("coach_client_memberships")
    .select("id, status, invited_at, accepted_at")
    .eq("coach_id", user!.id)
    .eq("client_id", clientId)
    .neq("status", "revoked")
    .maybeSingle();
  if (!membershipRes.data) notFound();

  const [profileRes, enrollmentsRes, coursesRes, notesRes, eventsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at").eq("id", clientId).single(),
    supabase.from("enrollments").select("id, course_id, enrolled_at").eq("coach_id", user!.id).eq("client_id", clientId).order("enrolled_at", { ascending: false }),
    supabase.from("courses").select("id, title, status, course_modules(id, lessons(id))").eq("coach_id", user!.id).order("title"),
    supabase.from("client_notes").select("id, body, created_at").eq("coach_id", user!.id).eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("events").select("id, title, event_type, start_time, location").eq("coach_id", user!.id).eq("client_id", clientId).order("start_time", { ascending: false }),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const progressRes = enrollmentIds.length > 0
    ? await supabase.from("lesson_progress").select("enrollment_id, lesson_id, progress_percent, completed_at, updated_at").in("enrollment_id", enrollmentIds)
    : { data: [], error: null };

  const errors = [membershipRes.error, profileRes.error, enrollmentsRes.error, coursesRes.error, notesRes.error, eventsRes.error, progressRes.error].filter(Boolean);
  if (errors.length > 0) await Promise.all(errors.map((error) => logServerError(error, "clients.profile-load", { userId: user!.id, userEmail: user!.email })));

  const profile = profileRes.data;
  if (!profile) notFound();
  const courses = coursesRes.data ?? [];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const progress = progressRes.data ?? [];
  const progressByEnrollment = new Map<string, typeof progress>();
  for (const row of progress) progressByEnrollment.set(row.enrollment_id, [...(progressByEnrollment.get(row.enrollment_id) ?? []), row]);
  const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.course_id));
  const availableCourses = courses.filter((course) => !enrolledCourseIds.has(course.id)).map(({ id, title }) => ({ id, title }));
  const events = eventsRes.data ?? [];
  const upcomingEvents = events.filter((event) => new Date(event.start_time) >= new Date()).reverse();

  const activity: ActivityItem[] = [
    ...events.map((event) => ({ id: `event-${event.id}`, date: event.start_time, label: event.title, detail: "Appointment", tone: "orange" })),
    ...enrollments.map((enrollment) => ({ id: `enrollment-${enrollment.id}`, date: enrollment.enrolled_at, label: courseById.get(enrollment.course_id)?.title ?? "Program", detail: "Enrolled", tone: "green" })),
    ...(notesRes.data ?? []).map((note) => ({ id: `note-${note.id}`, date: note.created_at, label: note.body, detail: "Private note", tone: "neutral" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const initials = (profile.full_name || profile.email).split(" ").map((part: string) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="page client-command-page">
      <div className="client-command-back"><Link href="/clients">← All clients</Link></div>
      <header className="client-command-hero">
        <div className="client-command-identity"><div className="client-command-avatar">{initials}</div><div><div className="modal-eyebrow">Client command center</div><h1>{profile.full_name || profile.email}</h1><p>{profile.email}</p></div></div>
        <div className="client-command-actions">
          <a className="btn" href={`mailto:${profile.email}`}>Email</a>
          <Link className="btn" href={`/calendar?client=${clientId}`}>Schedule session</Link>
          <EnrollClientButton clientId={clientId} availableCourses={availableCourses} />
        </div>
      </header>

      {errors.length > 0 && <DataLoadError what="this client profile" />}

      <div className="client-command-stats">
        <div><span>Status</span><strong>{membershipRes.data.status === "active" ? "Active" : "Invited"}</strong></div>
        <div><span>Programs</span><strong>{enrollments.length}</strong></div>
        <div><span>Upcoming</span><strong>{upcomingEvents.length}</strong></div>
        <div><span>Member since</span><strong>{new Date(membershipRes.data.accepted_at || membershipRes.data.invited_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</strong></div>
      </div>

      <div className="client-command-grid">
        <main>
          <section className="card"><div className="card-title">Programs & progress</div>
            {enrollments.length === 0 ? <div className="empty-state"><p>No programs yet. Enroll this client to begin tracking progress.</p></div> : enrollments.map((enrollment) => {
              const course = courseById.get(enrollment.course_id);
              const rows = progressByEnrollment.get(enrollment.id) ?? [];
              const lessonCount = course?.course_modules?.reduce((total: number, module: { lessons?: { id: string }[] }) => total + (module.lessons?.length ?? 0), 0) ?? 0;
              const completed = rows.filter((row) => row.completed_at || row.progress_percent === 100).length;
              const percent = lessonCount > 0 ? Math.round((completed / lessonCount) * 100) : 0;
              return <div className="client-program" key={enrollment.id}><div><strong>{course?.title || "Untitled program"}</strong><span>{completed} of {lessonCount} lessons complete</span></div><div className="client-program-progress"><div style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div>;
            })}
          </section>

          <section className="card"><div className="card-title">Upcoming appointments</div>
            {upcomingEvents.length === 0 ? <div className="sub">No upcoming sessions.</div> : upcomingEvents.slice(0, 5).map((event) => <Link className="client-appointment" href="/calendar" key={event.id}><time>{new Date(event.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<b>{new Date(event.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</b></time><div><strong>{event.title}</strong><span>{event.location || "No location added"}</span></div><span>→</span></Link>)}
          </section>
        </main>

        <aside>
          <ClientNotes coachId={user!.id} clientId={clientId} initialNotes={(notesRes.data as ClientNote[]) ?? []} />
          <section className="card"><div className="card-title">Recent activity</div><div className="client-activity">
            {activity.length === 0 ? <div className="sub">Activity will appear here.</div> : activity.map((item) => <div key={item.id}><i className={`is-${item.tone}`} /><div><strong>{item.label}</strong><span>{item.detail} · {new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div></div>)}
          </div></section>
        </aside>
      </div>
    </div>
  );
}
