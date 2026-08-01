"use client";

import { useState } from "react";

const COLORS = ["purple", "teal", "amber", "blue"];

export function CourseFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { title: string; description: string; category: string; color: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ title, description, category: category || "General", color });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="card-title">New course</div>

        <label className="rd-field">
          <span className="rd-field-label">Course title</span>
          <input className="rd-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Launch Your Group Program" required />
        </label>

        <label className="rd-field">
          <span className="rd-field-label">Description</span>
          <textarea
            className="rd-input rd-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students get out of this course?"
          />
        </label>

        <div className="two-col" style={{ marginBottom: 0 }}>
          <label className="rd-field">
            <span className="rd-field-label">Category</span>
            <input className="rd-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Business" />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Cover color</span>
            <select className="rd-input" value={color} onChange={(e) => setColor(e.target.value)}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rd-summary-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            Create course
          </button>
        </div>
      </form>
    </div>
  );
}
