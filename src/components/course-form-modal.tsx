"use client";

import { useState } from "react";
import type { Course, CourseInput, CourseStatus } from "@/lib/courses";
import { COURSE_STATUSES } from "@/lib/courses";
import { getErrorMessage } from "@/lib/errors";
import { useErrorToast } from "@/components/error-toast-provider";
import type { Business } from "@/lib/businesses";

type Props = {
  course: Course | null;
  onClose: () => void;
  onSave: (input: CourseInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  businesses: Business[];
};

export function CourseFormModal({ course, onClose, onSave, onDelete, businesses }: Props) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [status, setStatus] = useState<CourseStatus>(course?.status ?? "draft");
  const [businessId, setBusinessId] = useState(course?.business_id ?? businesses.find((business) => business.is_default)?.id ?? businesses[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useErrorToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ title, description, status, business_id: businessId });
    } catch (err) {
      setError(getErrorMessage(err));
      showError(err, "courses.save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
    } catch (err) {
      setError(getErrorMessage(err));
      showError(err, "courses.delete");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">{course ? "Edit course" : "New course"}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Student school</label>
            <select className="form-input" required value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.portal_name || business.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Title</label>
            <input className="form-input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as CourseStatus)}>
              {COURSE_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
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
            {onDelete && (
              <button
                className="btn btn-danger"
                type="button"
                style={{ marginLeft: "auto" }}
                disabled={saving}
                onClick={handleDelete}
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
