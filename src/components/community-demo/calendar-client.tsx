"use client";

import { useMemo, useState } from "react";
import { EventFormModal } from "@/components/community-demo/event-form-modal";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { EVENT_TYPE_LABEL, type DemoEvent } from "@/lib/community-demo-data";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TYPE_BADGE: Record<DemoEvent["type"], string> = {
  "live-call": "badge-red",
  workshop: "badge-purple",
  deadline: "badge-amber",
  community: "badge-blue",
};

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function isSameDay(a: Date, b: Date): boolean {
  return toKey(a) === toKey(b);
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function CalendarClient({ editable = false }: { editable?: boolean }) {
  const { events, addEvent, updateEvent, deleteEvent } = useCommunityDemo();
  const [view, setView] = useState<"week" | "month">("week");
  const [refDate, setRefDate] = useState(() => new Date());
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<DemoEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<DemoEvent | null>(null);

  const today = new Date();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DemoEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [events]);

  function handleSubmit(input: Omit<DemoEvent, "id">) {
    if (editingEvent) {
      updateEvent(editingEvent.id, input);
      setEditingEvent(null);
    } else {
      addEvent(input);
      setAddingForDate(null);
    }
  }

  function handleDelete() {
    if (!editingEvent) return;
    deleteEvent(editingEvent.id);
    setEditingEvent(null);
  }

  function openEvent(ev: DemoEvent) {
    if (editable) setEditingEvent(ev);
    else setViewingEvent(ev);
  }

  const weekDays = useMemo(() => {
    const start = startOfWeek(refDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [refDate]);

  const monthWeeks = useMemo(() => {
    const firstOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    const lastOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const gridEnd = startOfWeek(lastOfMonth);
    const totalDays = Math.round((addDays(gridEnd, 6).getTime() - gridStart.getTime()) / 86400000) + 1;
    const weeks: Date[][] = [];
    for (let i = 0; i < totalDays; i += 7) {
      weeks.push(Array.from({ length: 7 }, (_, j) => addDays(gridStart, i + j)));
    }
    return weeks;
  }, [refDate]);

  function shift(amount: number) {
    setRefDate((d) => (view === "week" ? addDays(d, amount * 7) : new Date(d.getFullYear(), d.getMonth() + amount, d.getDate())));
  }

  const rangeLabel =
    view === "week"
      ? `${MONTH_LABELS[weekDays[0].getMonth()]} ${weekDays[0].getDate()} – ${
          weekDays[6].getMonth() !== weekDays[0].getMonth() ? MONTH_LABELS[weekDays[6].getMonth()] + " " : ""
        }${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
      : `${MONTH_LABELS[refDate.getMonth()]} ${refDate.getFullYear()}`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-sub">
            {editable ? "Add live calls, workshops, and deadlines for the whole community." : "Live calls, workshops, and deadlines from your coach."}
          </div>
        </div>
        {editable && (
          <button className="btn btn-primary btn-sm" onClick={() => setAddingForDate(toKey(today))}>
            + Add event
          </button>
        )}
      </div>

      <div className="rd-cal-toolbar">
        <div className="rd-map-filters">
          <button className={`btn btn-sm${view === "week" ? " btn-primary" : ""}`} onClick={() => setView("week")}>
            Week
          </button>
          <button className={`btn btn-sm${view === "month" ? " btn-primary" : ""}`} onClick={() => setView("month")}>
            Month
          </button>
        </div>
        <div className="rd-cal-nav">
          <button className="btn btn-sm" onClick={() => shift(-1)} aria-label="Previous">
            ‹
          </button>
          <span className="rd-cal-range">{rangeLabel}</span>
          <button className="btn btn-sm" onClick={() => shift(1)} aria-label="Next">
            ›
          </button>
          <button className="btn btn-sm" onClick={() => setRefDate(new Date())}>
            Today
          </button>
        </div>
      </div>

      {view === "week" ? (
        <div className="rd-week">
          {weekDays.map((d) => {
            const key = toKey(d);
            const dayEvents = eventsByDate.get(key) ?? [];
            return (
              <div key={key} className={`card rd-week-day${isSameDay(d, today) ? " rd-day-today" : ""}`} style={{ marginBottom: 0 }}>
                <div className="rd-week-day-head">
                  <span className="rd-lead-name">{DAY_LABELS[(d.getDay() + 6) % 7]}</span>
                  <span className="mini-stat-label">
                    {MONTH_LABELS[d.getMonth()].slice(0, 3)} {d.getDate()}
                  </span>
                </div>
                {dayEvents.length === 0 ? (
                  <div className="mini-stat-label" style={{ padding: "10px 0" }}>
                    Nothing scheduled
                  </div>
                ) : (
                  dayEvents.map((ev) => (
                    <button key={ev.id} className="rd-week-event rd-week-event-btn" onClick={() => openEvent(ev)}>
                      {formatTime(ev.time)} — {ev.title}
                    </button>
                  ))
                )}
                {editable && (
                  <button className="rd-day-add" onClick={() => setAddingForDate(key)}>
                    + Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rd-month">
          <div className="rd-month-head">
            {DAY_LABELS.map((label) => (
              <div key={label} className="rd-month-head-cell">
                {label}
              </div>
            ))}
          </div>
          {monthWeeks.map((week, i) => (
            <div key={i} className="rd-month-row">
              {week.map((d) => {
                const key = toKey(d);
                const dayEvents = eventsByDate.get(key) ?? [];
                const inMonth = d.getMonth() === refDate.getMonth();
                return (
                  <div
                    key={key}
                    className={`rd-month-cell${inMonth ? "" : " rd-month-cell-out"}${isSameDay(d, today) ? " rd-day-today" : ""}`}
                    onClick={() => editable && setAddingForDate(key)}
                  >
                    <span className="rd-month-cell-date">{d.getDate()}</span>
                    <div className="rd-month-cell-events">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          className="rd-month-chip"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEvent(ev);
                          }}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && <div className="mini-stat-label">+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {editable && addingForDate && (
        <EventFormModal defaultDate={addingForDate} onClose={() => setAddingForDate(null)} onSubmit={handleSubmit} />
      )}

      {editable && editingEvent && (
        <EventFormModal
          initial={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
        />
      )}

      {!editable && viewingEvent && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setViewingEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className={`badge ${TYPE_BADGE[viewingEvent.type]}`} style={{ marginBottom: 10 }}>
              {EVENT_TYPE_LABEL[viewingEvent.type]}
            </span>
            <div className="card-title">{viewingEvent.title}</div>
            <p className="page-sub">
              {viewingEvent.date} at {formatTime(viewingEvent.time)}
            </p>
            <div className="rd-summary-actions">
              <button className="btn" onClick={() => setViewingEvent(null)}>
                Close
              </button>
              {viewingEvent.link && (
                <a href={viewingEvent.link} target="_blank" rel="noreferrer" className="btn btn-primary">
                  Join event
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
