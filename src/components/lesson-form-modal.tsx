"use client";

import { useState } from "react";
import type { LessonInput } from "@/lib/courses";
import { getErrorMessage } from "@/lib/errors";
import { useErrorToast } from "@/components/error-toast-provider";

type Props = {
  lesson?: { title: string; description: string | null; external_video_url: string | null } | null;
  onClose: () => void;
  onSave: (input: LessonInput) => Promise<void>;
};

export function LessonFormModal({ lesson, onClose, onSave }: Props) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.external_video_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useErrorToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ title, description, external_video_url: videoUrl });
    } catch (err) {
      setError(getErrorMessage(err));
      showError(err, "courses.lesson-save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">{lesson ? "Edit lesson" : "New lesson"}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Title</label>
            <input className="form-input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Lesson notes</label>
            <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Video or resource URL</label>
            <input
              className="form-input"
              placeholder="https://…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>

          {error && (
            <div className="notes-box" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
