"use client";

import { useState } from "react";

function extractYoutubeId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

export function LessonFormModal({
  courseTitle,
  onClose,
  onSubmit,
}: {
  courseTitle: string;
  onClose: () => void;
  onSubmit: (input: { title: string; durationMin: number; youtubeId: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [videoInput, setVideoInput] = useState("");
  const [durationMin, setDurationMin] = useState("10");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ title, durationMin: Number(durationMin) || 0, youtubeId: extractYoutubeId(videoInput) });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="card-title">Upload lesson to {courseTitle}</div>

        <label className="rd-field">
          <span className="rd-field-label">Lesson title</span>
          <input className="rd-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pricing your program" required />
        </label>

        <label className="rd-field">
          <span className="rd-field-label">YouTube link or video ID</span>
          <input
            className="rd-input"
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            required
          />
        </label>

        <label className="rd-field">
          <span className="rd-field-label">Duration (minutes)</span>
          <input className="rd-input" type="number" min={1} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
        </label>

        <div className="rd-summary-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || !videoInput.trim()}>
            Upload lesson
          </button>
        </div>
      </form>
    </div>
  );
}
