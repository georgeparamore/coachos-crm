"use client";

import { useState } from "react";
import type { DemoEvent, EventType, StreamPlatform } from "@/lib/community-demo-data";
import { EVENT_TYPE_LABEL, PLATFORM_LABEL } from "@/lib/community-demo-data";

type NewEventInput = Omit<DemoEvent, "id">;

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];
const PLATFORMS = Object.keys(PLATFORM_LABEL) as StreamPlatform[];

export function EventFormModal({
  initial,
  defaultDate,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial?: DemoEvent;
  defaultDate?: string;
  onClose: () => void;
  onSubmit: (event: NewEventInput) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [type, setType] = useState<EventType>(initial?.type ?? "community");
  const [platform, setPlatform] = useState<StreamPlatform | "">(initial?.platform ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const needsPlatform = type === "live-call" || type === "workshop" || type === "community";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title,
      date,
      time,
      type,
      platform: needsPlatform && platform ? platform : undefined,
      link: needsPlatform && link ? link : undefined,
    });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="card-title">{initial ? "Edit event" : "Add event"}</div>

        <label className="rd-field">
          <span className="rd-field-label">Title</span>
          <input
            className="rd-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Live Q&A: launch calendar walkthrough"
            required
          />
        </label>

        <div className="two-col" style={{ marginBottom: 0 }}>
          <label className="rd-field">
            <span className="rd-field-label">Date</span>
            <input className="rd-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Time</span>
            <input className="rd-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
        </div>

        <label className="rd-field">
          <span className="rd-field-label">Event type</span>
          <select className="rd-input" value={type} onChange={(e) => setType(e.target.value as EventType)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>

        {needsPlatform && (
          <>
            <label className="rd-field">
              <span className="rd-field-label">Where it happens</span>
              <select className="rd-input" value={platform} onChange={(e) => setPlatform(e.target.value as StreamPlatform)}>
                <option value="">Select a platform…</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="rd-field">
              <span className="rd-field-label">Join link</span>
              <input
                className="rd-input"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://zoom.us/j/…"
              />
            </label>
          </>
        )}

        <div className="rd-summary-actions" style={{ justifyContent: initial ? "space-between" : "flex-end" }}>
          {initial &&
            onDelete &&
            (confirmDelete ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
                  Confirm delete
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {initial ? "Save changes" : "Add event"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
