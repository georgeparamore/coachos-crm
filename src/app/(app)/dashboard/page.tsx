import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_CLASSES, initialsOf } from "@/lib/format";
import { EVENT_TYPE_BADGE, EVENT_TYPE_LABEL, type CalendarEvent } from "@/lib/events";
import { PLANS } from "@/lib/stripe";
import { formatCurrencyWhole } from "@/lib/analytics";
import { getZonedDayBounds, formatDateInZone } from "@/lib/timezone";
import { TodayReminders } from "@/components/today-reminders";
import { DailyCheckin } from "@/components/daily-checkin";
import { LiveClock } from "@/components/live-clock";
import { PreviewCard, MiniStat } from "@/components/preview-card";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("timezone, full_name").eq("id", user!.id).single();
  const timezone = profile?.timezone || "UTC";
  const firstName = profile?.full_name?.trim().split(" ")[0] || "there";

  const now = new Date();
  const { start: startOfDay, end: endOfDay } = getZonedDayBounds(timezone, now);

  const [leadsRes, eventsRes, subsRes, invoicesRes, contractsRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, stage, source, value_cents, created_at")
      .eq("coach_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*")
      .eq("coach_id", user!.id)
      .gte("start_time", startOfDay.toISOString())
      .lt("start_time", endOfDay.toISOString())
      .order("start_time", { ascending: true }),
    supabase.from("subscriptions").select("status, plan_key").eq("coach_id", user!.id),
    supabase.from("invoices").select("status, amount_cents, created_at").eq("coach_id", user!.id),
    supabase.from("contracts").select("status").eq("coach_id", user!.id),
  ]);
  const { data: leads } = leadsRes;
  const { data: todaysEvents } = eventsRes;
  const { data: subscriptions } = subsRes;
  const { data: invoices } = invoicesRes;
  const { data: contracts } = contractsRes;

  const queryErrors = [leadsRes.error, eventsRes.error, subsRes.error, invoicesRes.error, contractsRes.error].filter(
    Boolean,
  );
  if (queryErrors.length > 0) {
    await Promise.all(
      queryErrors.map((err) => logServerError(err, "dashboard.load", { userId: user!.id, userEmail: user!.email })),
    );
  }

  const allLeads = leads ?? [];
  const activeClients = allLeads.filter((l) => l.stage === "signed").length;
  const openLeads = allLeads.filter((l) => l.stage !== "signed").length;
  const recentLeads = allLeads.slice(0, 5);
  const newLeadCount = allLeads.filter((l) => l.stage === "new").length;
  const events = (todaysEvents as CalendarEvent[]) ?? [];

  const winRate = allLeads.length > 0 ? Math.round((activeClients / allLeads.length) * 100) : 0;
  const openPipelineValue = allLeads
    .filter((l) => l.stage !== "signed")
    .reduce((sum, l) => sum + (l.value_cents ?? 0), 0);

  const allSubs = subscriptions ?? [];
  const activeSubs = allSubs.filter((s) => s.status === "active");
  const mrrCents = activeSubs.reduce((sum, s) => sum + (PLANS[s.plan_key as keyof typeof PLANS]?.amountCents ?? 0), 0);

  const allInvoices = invoices ?? [];
  const outstandingCents = allInvoices.filter((i) => i.status === "open").reduce((sum, i) => sum + i.amount_cents, 0);
  const { start: monthStart } = getZonedDayBounds(timezone, new Date(now.getFullYear(), now.getMonth(), 1));
  const collectedThisMonthCents = allInvoices
    .filter((i) => i.status === "paid" && new Date(i.created_at) >= monthStart)
    .reduce((sum, i) => sum + i.amount_cents, 0);

  const allContracts = (contracts as { status: string }[] | null) ?? [];
  const pendingContracts = allContracts.filter((c) => c.status === "sent" || c.status === "viewed").length;
  const signedContracts = allContracts.filter((c) => c.status === "signed").length;

  const formattedDate = formatDateInZone(now, timezone);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Good morning, Coach — {formattedDate}</div>
          <div className="page-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Here&apos;s what&apos;s happening with your business today</span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <LiveClock timezone={timezone} />
          </div>
        </div>
      </div>

      <DailyCheckin firstName={firstName} todayEventCount={events.length} newLeadCount={newLeadCount} />

      <TodayReminders events={events} />

      {queryErrors.length > 0 && <DataLoadError what="some of your dashboard data" />}

      <div className="preview-grid" style={{ marginBottom: 24 }}>
        <PreviewCard title="Recent leads" href="/crm">
          {recentLeads.length === 0 ? (
            <div className="sub">No leads yet.</div>
          ) : (
            recentLeads.slice(0, 4).map((lead) => (
              <Link
                href={`/crm?lead=${lead.id}`}
                className="list-row list-row-clickable"
                key={lead.id}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="list-row-left">
                  <div className={`avatar av-sm ${AVATAR_CLASSES[lead.id.charCodeAt(0) % AVATAR_CLASSES.length]}`}>
                    {initialsOf(lead.name)}
                  </div>
                  <div className="name">{lead.name}</div>
                </div>
                <span className="badge badge-blue">{lead.stage.replace("_", " ")}</span>
              </Link>
            ))
          )}
        </PreviewCard>

        <PreviewCard title="Today's schedule" href="/calendar">
          {events.length === 0 ? (
            <div className="sub">Nothing on the calendar today.</div>
          ) : (
            events.slice(0, 4).map((event) => (
              <div className="list-row" key={event.id}>
                <div>
                  <div className="name">{event.title}</div>
                  <div className="sub">
                    {new Date(event.start_time).toLocaleTimeString(undefined, {
                      timeZone: timezone,
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span className={`badge ${EVENT_TYPE_BADGE[event.event_type]}`}>{EVENT_TYPE_LABEL[event.event_type]}</span>
              </div>
            ))
          )}
        </PreviewCard>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Active clients</div>
          <div className="metric-value">{activeClients}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Monthly revenue</div>
          <div className="metric-value">{formatCurrencyWhole(mrrCents)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Open leads</div>
          <div className="metric-value">{openLeads}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Course enrollments</div>
          <div className="metric-value">—</div>
          <div className="metric-delta delta-neutral">Connect courses in Phase 3</div>
        </div>
      </div>

      <div className="preview-grid">
        <PreviewCard title="Analytics" href="/analytics">
          <MiniStat label="Win rate" value={`${winRate}%`} />
          <MiniStat label="Open pipeline value" value={formatCurrencyWhole(openPipelineValue)} />
          <MiniStat label="Total leads" value={String(allLeads.length)} />
        </PreviewCard>

        <PreviewCard title="Subscriptions" href="/subscriptions">
          <MiniStat label="Monthly recurring revenue" value={formatCurrencyWhole(mrrCents)} />
          <MiniStat label="Active subscribers" value={String(activeSubs.length)} />
        </PreviewCard>

        <PreviewCard title="Invoices" href="/invoices">
          <MiniStat label="Outstanding" value={formatCurrencyWhole(outstandingCents)} />
          <MiniStat label="Collected this month" value={formatCurrencyWhole(collectedThisMonthCents)} />
        </PreviewCard>

        <PreviewCard title="Contracts" href="/contracts">
          <MiniStat label="Awaiting signature" value={String(pendingContracts)} />
          <MiniStat label="Signed" value={String(signedContracts)} />
        </PreviewCard>
      </div>
    </div>
  );
}
