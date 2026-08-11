"use client";

import { useState } from "react";
import type { CalendarEvent, EventType } from "@/lib/events";
import { EVENT_TYPE_LABEL } from "@/lib/events";
import type { Lead } from "@/lib/leads";
import { getErrorMessage } from "@/lib/errors";
import { useErrorToast } from "@/components/error-toast-provider";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventFormModal({
  event,
  defaultDate,
  leads,
  onClose,
  onSave,
  onDelete,
  defaultLeadId,
  defaultClientId,
  defaultClientName,
}: {
  event: CalendarEvent | null;
  defaultDate: Date;
  leads: Lead[];
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string;
    event_type: EventType;
    start_time: string;
    end_time: string | null;
    location: string;
    lead_id: string | null;
    client_id: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  defaultLeadId?: string;
  defaultClientId?: string;
  defaultClientName?: string;
}) {
  const initialStart = event ? new Date(event.start_time) : (() => {
    const d = new Date(defaultDate);
    d.setHours(9, 0, 0, 0);
    return d;
  })();

  const [title, setTitle] = useState(event?.title ?? "");
  const [eventType, setEventType] = useState<EventType>(event?.event_type ?? "meeting");
  const [startTime, setStartTime] = useState(toLocalInputValue(initialStart));
  const [endTime, setEndTime] = useState(event?.end_time ? toLocalInputValue(new Date(event.end_time)) : "");
  const [leadId, setLeadId] = useState(event?.lead_id ?? defaultLeadId ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useErrorToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        event_type: eventType,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        location,
        lead_id: leadId || null,
        client_id: event?.client_id ?? defaultClientId ?? null,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      showError(err, "calendar.event-save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">{event ? "Edit event" : "New event"}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Title</label>
            <input className="form-input" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Type</label>
            <select className="form-input" value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
              {Object.entries(EVENT_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Start</label>
            <input
              className="form-input"
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">End (optional)</label>
            <input className="form-input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          {leads.length > 0 && (
            <div className="form-row">
              <label className="form-label">Link to a lead (optional)</label>
              <select className="form-input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">— None —</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(event?.client_id || defaultClientId) && (
            <div className="notes-box" style={{ marginBottom: 14 }}>
              Linked client: <strong>{defaultClientName || "Client"}</strong>
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Location / link</label>
            <input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && (
            <div className="notes-box" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            {onDelete && (
              <button
                className="btn btn-danger"
                type="button"
                style={{ marginLeft: "auto" }}
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onDelete();
                  } catch (err) {
                    setError(getErrorMessage(err));
                    showError(err, "calendar.event-delete");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
