const MOCK_WEEK = [
  { day: "Mon", date: "Jul 27", events: [] as string[] },
  { day: "Tue", date: "Jul 28", events: ["10:00 — Showing: 2210 Desert Rose Ln (Priya Nair)"] },
  {
    day: "Wed",
    date: "Jul 29",
    events: ["2:00 — Showing: 412 Willow Creek Dr (Sarah Chen)", "4:30 — Call: Marcus Webb (comp report follow-up)"],
  },
  { day: "Thu", date: "Jul 30", events: [] },
  { day: "Fri", date: "Jul 31", events: ["11:00 — Listing consult: Marcus Webb"] },
  { day: "Sat", date: "Aug 1", events: ["10:00 — Showing: 412 Willow Creek Dr (Sarah Chen, 2nd visit)"] },
  { day: "Sun", date: "Aug 2", events: [] },
];

export default function CalendarPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-sub">This week&apos;s showings and calls — Home only shows today&apos;s.</div>
        </div>
      </div>
      <div className="rd-week">
        {MOCK_WEEK.map((d) => (
          <div key={d.day} className="card rd-week-day" style={{ marginBottom: 0 }}>
            <div className="rd-week-day-head">
              <span className="rd-lead-name">{d.day}</span>
              <span className="mini-stat-label">{d.date}</span>
            </div>
            {d.events.length === 0 ? (
              <div className="mini-stat-label" style={{ padding: "10px 0" }}>
                No bookings
              </div>
            ) : (
              d.events.map((ev, i) => (
                <div key={i} className="rd-week-event">
                  {ev}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
