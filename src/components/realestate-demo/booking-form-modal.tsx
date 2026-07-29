"use client";

import { useState } from "react";
import type { DemoListing } from "@/lib/realestate-demo-data";

export function BookingFormModal({
  listing,
  onClose,
  onSubmit,
}: {
  listing: DemoListing;
  onClose: () => void;
  onSubmit: (details: { name: string; phone: string; date: string; time: string; notes: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, phone, date, time, notes });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="card-title">Book a showing</div>
        <div className="page-sub" style={{ marginBottom: 16 }}>
          {listing.address}, {listing.city}
        </div>

        <label className="rd-field">
          <span className="rd-field-label">Client name</span>
          <input
            className="rd-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Who's this showing for?"
            required
          />
        </label>

        <label className="rd-field">
          <span className="rd-field-label">Phone</span>
          <input
            className="rd-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            required
          />
        </label>

        <div className="two-col" style={{ marginBottom: 0 }}>
          <label className="rd-field">
            <span className="rd-field-label">Date</span>
            <input
              className="rd-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Time</span>
            <input
              className="rd-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="rd-field">
          <span className="rd-field-label">Notes (optional)</span>
          <textarea
            className="rd-input rd-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember for this showing…"
          />
        </label>

        <div className="rd-summary-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Request showing
          </button>
        </div>
      </form>
    </div>
  );
}
