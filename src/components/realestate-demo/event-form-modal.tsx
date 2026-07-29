"use client";

import { useState } from "react";
import type { DemoEvent } from "@/lib/realestate-demo-data";

type NewEventInput = Omit<DemoEvent, "id">;

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ title, date, time });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="card-title">{initial ? "Edit event" : "Add event"}</div>

        <label className="rd-field">
          <span className="rd-field-label">What is it</span>
          <input
            className="rd-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Showing: 123 Main St (Jane Doe)"
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
