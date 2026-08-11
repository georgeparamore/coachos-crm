import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar-view";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";
import type { CalendarEvent } from "@/lib/events";
import type { Lead } from "@/lib/leads";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: initialLeadId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [eventsRes, leadsRes] = await Promise.all([
    supabase.from("events").select("*").eq("coach_id", user!.id).order("start_time", { ascending: true }),
    supabase.from("leads").select("*").eq("coach_id", user!.id).order("created_at", { ascending: false }),
  ]);
  const { data: events } = eventsRes;
  const { data: leads } = leadsRes;

  const queryErrors = [eventsRes.error, leadsRes.error].filter(Boolean);
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "calendar.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-sub">Schedule calls, sessions, and reminders</div>
        </div>
      </div>

      {queryErrors.length > 0 && <DataLoadError what="your calendar" />}

      <CalendarView initialEvents={(events as CalendarEvent[]) ?? []} leads={(leads as Lead[]) ?? []} coachId={user!.id} initialLeadId={initialLeadId} />
    </div>
  );
}
