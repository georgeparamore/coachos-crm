"use client";

import { useMemo, useState } from "react";
import { NavIcon } from "@/components/nav-icon";
import { useCommunityDemo } from "@/lib/community-demo-store";
import { EventFormModal } from "@/components/community-demo/event-form-modal";
import { PLATFORM_LABEL, type DemoEvent } from "@/lib/community-demo-data";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PLATFORM_ICON: Record<string, string> = {
  "google-meet": "video",
  zoom: "video",
  native: "monitor",
};

function StreamRow({ event, onEdit }: { event: DemoEvent; onEdit: () => void }) {
  return (
    <div className="mini-stat-row">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <NavIcon name={PLATFORM_ICON[event.platform ?? "native"]} />
        <div>
          <div className="mini-stat-value" style={{ fontWeight: 500 }}>
            {event.title}
          </div>
          <div className="mini-stat-label">
            {event.date} at {event.time} · {event.platform ? PLATFORM_LABEL[event.platform] : "No platform set"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {event.link && (
          <a href={event.link} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
            Open
          </a>
        )}
        <button className="btn btn-sm" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  );
}

export function LiveStreamManager() {
  const { events, addEvent, updateEvent, deleteEvent } = useCommunityDemo();
  const [scheduling, setScheduling] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DemoEvent | null>(null);

  const streams = useMemo(
    () => events.filter((e) => e.type === "live-call" || e.type === "workshop").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [events],
  );

  const upcoming = streams.filter((e) => e.date >= todayKey());
  const past = streams.filter((e) => e.date < todayKey());

  function handleSubmit(input: Omit<DemoEvent, "id">) {
    if (editingEvent) {
      updateEvent(editingEvent.id, input);
      setEditingEvent(null);
    } else {
      addEvent(input);
      setScheduling(false);
    }
  }

  return (
    <div>
      <div className="cp-live-platforms">
        <div className="card cp-platform-card">
          <NavIcon name="video" />
          <div className="cp-lead-name">Google Meet</div>
          <p className="mini-stat-label">Paste a Meet link when scheduling — students see a &quot;Join&quot; button at the right time.</p>
        </div>
        <div className="card cp-platform-card">
          <NavIcon name="video" />
          <div className="cp-lead-name">Zoom</div>
          <p className="mini-stat-label">Same flow — drop in your Zoom meeting link, webinar or regular.</p>
        </div>
        <div className="card cp-platform-card">
          <NavIcon name="monitor" />
          <div className="cp-lead-name">Ridgeline Live</div>
          <p className="mini-stat-label">Stream natively in-app, no third-party link required.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div className="card-title">Upcoming streams</div>
          <button className="btn btn-primary btn-sm" onClick={() => setScheduling(true)}>
            + Schedule stream
          </button>
        </div>
        {upcoming.length === 0 && <p className="page-sub">Nothing scheduled — schedule your next live call or workshop.</p>}
        {upcoming.map((ev) => (
          <StreamRow key={ev.id} event={ev} onEdit={() => setEditingEvent(ev)} />
        ))}
      </div>

      <div className="card">
        <div className="card-title">Past streams</div>
        {past.length === 0 && <p className="page-sub">No past streams yet.</p>}
        {past.map((ev) => (
          <StreamRow key={ev.id} event={ev} onEdit={() => setEditingEvent(ev)} />
        ))}
      </div>

      {scheduling && (
        <EventFormModal
          defaultDate={todayKey()}
          onClose={() => setScheduling(false)}
          onSubmit={handleSubmit}
        />
      )}

      {editingEvent && (
        <EventFormModal
          initial={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSubmit={handleSubmit}
          onDelete={() => {
            deleteEvent(editingEvent.id);
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}
