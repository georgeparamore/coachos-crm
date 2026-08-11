import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import { BarList } from "@/components/charts/bar-list";
import { SeriesChart } from "@/components/charts/series-chart";
import styles from "./dashboard.module.css";

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("timezone, full_name, role").eq("id", user!.id).single();

  // This whole page is coach-oriented business KPIs — a client landing here
  // (e.g. straight after login) belongs on their own classroom instead.
  if (profile?.role === "client") redirect("/classroom");

  const timezone = profile?.timezone || "UTC";
  const firstName = profile?.full_name?.trim().split(" ")[0] || "there";

  const now = new Date();
  const { start: startOfDay, end: endOfDay } = getZonedDayBounds(timezone, now);

  const [leadsRes, eventsRes, futureClientEventsRes, membershipsRes, invitesRes, enrollmentsRes, subsRes, invoicesRes, contractsRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, stage, source, value_cents, follow_up_at, created_at")
      .eq("coach_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*")
      .eq("coach_id", user!.id)
      .gte("start_time", startOfDay.toISOString())
      .lt("start_time", endOfDay.toISOString())
      .order("start_time", { ascending: true }),
    supabase.from("events").select("client_id, start_time").eq("coach_id", user!.id).not("client_id", "is", null).gte("start_time", now.toISOString()),
    supabase.from("coach_client_memberships").select("client_id").eq("coach_id", user!.id).eq("status", "active"),
    supabase.from("client_invites").select("id, email, full_name, invited_at").eq("coach_id", user!.id).eq("status", "pending").order("invited_at", { ascending: true }),
    supabase.from("enrollments").select("id, client_id, enrolled_at").eq("coach_id", user!.id),
    supabase.from("subscriptions").select("status, plan_key").eq("coach_id", user!.id),
    supabase.from("invoices").select("status, amount_cents, created_at").eq("coach_id", user!.id),
    supabase.from("contracts").select("status").eq("coach_id", user!.id),
  ]);
  const { data: leads } = leadsRes;
  const { data: todaysEvents } = eventsRes;
  const { data: futureClientEvents } = futureClientEventsRes;
  const { data: memberships } = membershipsRes;
  const { data: pendingInvitesData } = invitesRes;
  const { data: enrollmentsData } = enrollmentsRes;
  const { data: subscriptions } = subsRes;
  const { data: invoices } = invoicesRes;
  const { data: contracts } = contractsRes;

  const clientIds = (memberships ?? []).map((membership) => membership.client_id);
  const enrollmentIds = (enrollmentsData ?? []).map((enrollment) => enrollment.id);
  const [clientProfilesRes, progressRes] = await Promise.all([
    clientIds.length > 0 ? supabase.from("profiles").select("id, full_name, email").in("id", clientIds) : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length > 0 ? supabase.from("lesson_progress").select("enrollment_id, progress_percent, completed_at, updated_at").in("enrollment_id", enrollmentIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const queryErrors = [leadsRes.error, eventsRes.error, futureClientEventsRes.error, membershipsRes.error, invitesRes.error, enrollmentsRes.error, clientProfilesRes.error, progressRes.error, subsRes.error, invoicesRes.error, contractsRes.error].filter(
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
  const newLeadCount = allLeads.filter((l) => l.stage === "new").length;
  const events = (todaysEvents as CalendarEvent[]) ?? [];
  const clientNameById = new Map((clientProfilesRes.data ?? []).map((client) => [client.id, client.full_name || client.email || "Client"]));

  type AttentionItem = { id: string; title: string; detail: string; href: string; label: string; priority: "high" | "medium" | "low" };
  const attentionItems: AttentionItem[] = [];
  const dueByEndOfDay = endOfDay.getTime();
  for (const lead of allLeads) {
    if (lead.stage === "signed") continue;
    if (lead.follow_up_at) {
      const followUpTime = new Date(lead.follow_up_at).getTime();
      if (followUpTime < now.getTime()) attentionItems.push({ id: `overdue-${lead.id}`, title: lead.name, detail: `Follow-up was due ${new Date(lead.follow_up_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, href: `/crm?lead=${lead.id}`, label: "Overdue", priority: "high" });
      else if (followUpTime <= dueByEndOfDay) attentionItems.push({ id: `due-${lead.id}`, title: lead.name, detail: `Follow up at ${new Date(lead.follow_up_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`, href: `/crm?lead=${lead.id}`, label: "Today", priority: "medium" });
    } else {
      attentionItems.push({ id: `unscheduled-${lead.id}`, title: lead.name, detail: "Open lead has no next follow-up", href: `/crm?lead=${lead.id}`, label: "Needs next step", priority: "low" });
    }
  }
  for (const invite of pendingInvitesData ?? []) attentionItems.push({ id: `invite-${invite.id}`, title: invite.full_name || invite.email, detail: `Invitation pending since ${new Date(invite.invited_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, href: "/clients", label: "Pending invite", priority: "medium" });
  const scheduledClientIds = new Set((futureClientEvents ?? []).map((event) => event.client_id).filter(Boolean));
  for (const membership of memberships ?? []) if (!scheduledClientIds.has(membership.client_id)) attentionItems.push({ id: `session-${membership.client_id}`, title: clientNameById.get(membership.client_id) || "Client", detail: "No upcoming coaching session", href: `/calendar?client=${membership.client_id}`, label: "Schedule", priority: "medium" });

  const progressByEnrollment = new Map<string, { progress_percent: number; completed_at: string | null; updated_at: string }[]>();
  for (const row of progressRes.data ?? []) progressByEnrollment.set(row.enrollment_id, [...(progressByEnrollment.get(row.enrollment_id) ?? []), row]);
  const stalledBefore = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  for (const enrollment of enrollmentsData ?? []) {
    const rows = progressByEnrollment.get(enrollment.id) ?? [];
    if (rows.length === 0) {
      if (new Date(enrollment.enrolled_at).getTime() < stalledBefore) attentionItems.push({ id: `not-started-${enrollment.id}`, title: clientNameById.get(enrollment.client_id) || "Client", detail: "Has not started an enrolled program", href: `/clients/${enrollment.client_id}`, label: "Not started", priority: "low" });
      continue;
    }
    const latestUpdate = Math.max(...rows.map((row) => new Date(row.updated_at).getTime()));
    const incomplete = rows.some((row) => !row.completed_at && row.progress_percent < 100);
    if (incomplete && latestUpdate < stalledBefore) attentionItems.push({ id: `stalled-${enrollment.id}`, title: clientNameById.get(enrollment.client_id) || "Client", detail: "Program progress has been quiet for 14+ days", href: `/clients/${enrollment.client_id}`, label: "Stalled", priority: "low" });
  }
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  attentionItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

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

  // New leads per day, last 7 days
  const days: Date[] = [];
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const signupTrend = days.map((day) => {
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const count = allLeads.filter((l) => {
      const created = new Date(l.created_at);
      return created >= day && created < dayEnd;
    }).length;
    return { label: dayLabel(day), value: count };
  });

  // Lead sources (top 5 + Other)
  const sourceCounts = new Map<string, number>();
  for (const lead of allLeads) {
    const key = lead.source?.trim() || "Unspecified";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sortedSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topSources = sortedSources.slice(0, 5);
  const otherCount = sortedSources.slice(5).reduce((sum, [, count]) => sum + count, 0);
  const sourceData = [
    ...topSources.map(([label, value]) => ({ label, value, color: "var(--chart-trend)" })),
    ...(otherCount > 0 ? [{ label: "Other", value: otherCount, color: "var(--text-3)" }] : []),
  ];

  return (
    <div className={`${styles.dashboard} page`}>
      <div className={`${styles.hero} page-header`}>
        <div>
          <div className={styles.eyebrow}>Business overview</div>
          <div className="page-title">Good morning, {firstName}.</div>
          <div className="page-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{formattedDate}</span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <LiveClock timezone={timezone} />
          </div>
        </div>
        <Link className="btn btn-primary" href="/crm">
          Add a lead <span aria-hidden="true">+</span>
        </Link>
      </div>

      <DailyCheckin firstName={firstName} todayEventCount={events.length} newLeadCount={newLeadCount} />

      <TodayReminders events={events} />

      {queryErrors.length > 0 && <DataLoadError what="some of your dashboard data" />}

      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.sectionEyebrow}>Today</div>
          <h2>What needs your attention</h2>
        </div>
      </div>

      <div className={styles.focusGrid}>
        <div className={`card ${styles.attentionCard}`}>
          <div className="card-title-row"><div className="card-title">Priority queue</div><Link href="/crm">View leads →</Link></div>
          {attentionItems.length === 0 ? (
            <div className={styles.allClear}><span>✓</span><div><strong>You’re all caught up</strong><p>No overdue follow-ups or client actions right now.</p></div></div>
          ) : (
            attentionItems.slice(0, 5).map((item) => <Link href={item.href} className={styles.attentionRow} key={item.id}><i className={styles[item.priority]} /><div><strong>{item.title}</strong><span>{item.detail}</span></div><b>{item.label}</b><span>→</span></Link>)
          )}
        </div>

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

      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.sectionEyebrow}>Performance</div>
          <h2>Your business at a glance</h2>
        </div>
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
          <div className="metric-value">{(enrollmentsData ?? []).length}</div>
          <div className="metric-delta delta-neutral">Across active clients</div>
        </div>
      </div>

      <div className={`${styles.insightsGrid} two-col`}>
        <div className="card">
          <div className="chart-card-header">
            <div className="card-title" style={{ marginBottom: 0 }}>
              New leads, last 7 days
            </div>
            <div className="chart-headline">{signupTrend.reduce((sum, d) => sum + d.value, 0)}</div>
          </div>
          {allLeads.length === 0 ? (
            <div className="empty-state">
              <p>No leads yet — add some in the CRM to see this trend.</p>
            </div>
          ) : (
            <SeriesChart points={signupTrend} color="var(--chart-trend)" mode="bar" />
          )}
        </div>

        <div className="card">
          <div className="card-title">Lead sources</div>
          {sourceData.length === 0 ? (
            <div className="empty-state">
              <p>No leads yet.</p>
            </div>
          ) : (
            <BarList data={sourceData} formatValue={(n) => String(n)} total={allLeads.length} />
          )}
        </div>
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.sectionEyebrow}>Workspace</div>
          <h2>Business tools</h2>
        </div>
      </div>

      <div className={styles.toolsGrid}>
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
