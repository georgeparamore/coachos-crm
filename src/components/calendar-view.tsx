"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EVENT_TYPE_BADGE, EVENT_TYPE_LABEL, isSameDay, type CalendarEvent, type EventType } from "@/lib/events";
import { EventFormModal } from "@/components/event-form-modal";
import type { Lead } from "@/lib/leads";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function buildMonthGrid(monthStart: Date) {
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function buildWeekGrid(cursor: Date) {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function CalendarView({
  initialEvents,
  leads,
  coachId,
}: {
  initialEvents: CalendarEvent[];
  leads: Lead[];
  coachId: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState<"week" | "month">("week");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [modalState, setModalState] = useState<{ event: CalendarEvent | null } | null>(null);

  const days = useMemo(
    () => (view === "month" ? buildMonthGrid(monthCursor) : buildWeekGrid(selectedDate)),
    [monthCursor, selectedDate, view],
  );
  const today = new Date();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.start_time).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [events]);

  const selectedDayEvents = eventsByDay.get(selectedDate.toDateString()) ?? [];

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.start_time) >= now)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, 8);
  }, [events]);

  function jumpToEvent(event: CalendarEvent) {
    const date = new Date(event.start_time);
    setSelectedDate(date);
    setMonthCursor(startOfMonth(date));
    setModalState({ event });
  }

  function moveCursor(direction: -1 | 1) {
    if (view === "month") {
      setMonthCursor((cursor) => new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
      return;
    }
    setSelectedDate((date) => {
      const next = new Date(date);
      next.setDate(next.getDate() + direction * 7);
      setMonthCursor(startOfMonth(next));
      return next;
    });
  }

  const rangeLabel = view === "month"
    ? monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  async function handleSave(input: {
    title: string;
    description: string;
    event_type: EventType;
    start_time: string;
    end_time: string | null;
    location: string;
    lead_id: string | null;
  }) {
    const supabase = createClient();
    if (modalState?.event) {
      const { data, error } = await supabase
        .from("events")
        .update(input)
        .eq("id", modalState.event.id)
        .select()
        .single();
      if (error) throw error;
      setEvents((prev) => prev.map((e) => (e.id === data.id ? (data as CalendarEvent) : e)));
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...input, coach_id: coachId })
        .select()
        .single();
      if (error) throw error;
      setEvents((prev) => [...prev, data as CalendarEvent]);
    }
    setModalState(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!modalState?.event) return;
    const supabase = createClient();
    const { error } = await supabase.from("events").delete().eq("id", modalState.event.id);
    if (error) throw error;
    setEvents((prev) => prev.filter((e) => e.id !== modalState.event!.id));
    setModalState(null);
    router.refresh();
  }

  return (
    <>
      <div className="two-col" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start" }}>
        <div className="card">
          <div className="calendar-header">
            <div className="calendar-navigation">
              <button className="btn btn-sm" onClick={() => moveCursor(-1)} aria-label={`Previous ${view}`}>←</button>
              <div className="calendar-month-label">{rangeLabel}</div>
              <button className="btn btn-sm" onClick={() => moveCursor(1)} aria-label={`Next ${view}`}>→</button>
            </div>
            <div className="calendar-view-toggle" aria-label="Calendar view">
              <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
              <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button>
            </div>
          </div>

          <div className="calendar-grid" style={{ marginBottom: 6 }}>
            {WEEKDAYS.map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}
          </div>
          <div className={`calendar-grid ${view === "week" ? "is-week" : "is-month"}`}>
            {days.map((day) => {
              const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
              const classes = [
                "calendar-day",
                view === "month" && day.getMonth() !== monthCursor.getMonth() ? "is-outside" : "",
                isSameDay(day, today) ? "is-today" : "",
                isSameDay(day, selectedDate) ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div className={classes} key={day.toISOString()} onClick={() => setSelectedDate(day)}>
                  <div className="calendar-day-number">{day.getDate()}</div>
                  {view === "month" && dayEvents.length > 0 && (
                    <div className="calendar-day-dots">
                      {dayEvents.slice(0, 4).map((e) => (
                        <div className="calendar-day-dot" key={e.id} />
                      ))}
                    </div>
                  )}
                  {view === "week" && (
                    <div className="calendar-week-events">
                      {dayEvents.length === 0 ? (
                        <span className="calendar-no-events">Open</span>
                      ) : dayEvents.map((event) => (
                        <button
                          className="calendar-week-event"
                          key={event.id}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setModalState({ event });
                          }}
                        >
                          <span>{new Date(event.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                          {event.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">
              {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }} onClick={() => setModalState({ event: null })}>
              Add event
            </button>
            {selectedDayEvents.length === 0 ? (
              <div className="sub">No events scheduled.</div>
            ) : (
              selectedDayEvents.map((event) => (
                <div className="list-row list-row-clickable" key={event.id} onClick={() => setModalState({ event })}>
                  <div>
                    <div className="name">{event.title}</div>
                    <div className="sub">
                      {new Date(event.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      {event.location ? ` · ${event.location}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${EVENT_TYPE_BADGE[event.event_type]}`}>{EVENT_TYPE_LABEL[event.event_type]}</span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-title">Upcoming appointments</div>
            {upcomingEvents.length === 0 ? (
              <div className="sub">Nothing coming up.</div>
            ) : (
              upcomingEvents.map((event) => (
                <div className="list-row list-row-clickable" key={event.id} onClick={() => jumpToEvent(event)}>
                  <div>
                    <div className="name">{event.title}</div>
                    <div className="sub">
                      {new Date(event.start_time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {" · "}
                      {new Date(event.start_time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <span className={`badge ${EVENT_TYPE_BADGE[event.event_type]}`}>{EVENT_TYPE_LABEL[event.event_type]}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalState && (
        <EventFormModal
          event={modalState.event}
          defaultDate={selectedDate}
          leads={leads}
          onClose={() => setModalState(null)}
          onSave={handleSave}
          onDelete={modalState.event ? handleDelete : undefined}
        />
      )}
    </>
  );
}
