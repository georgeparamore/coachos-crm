"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

type Course = { id: string; title: string };

export function EnrollClientButton({ clientId, availableCourses }: { clientId: string; availableCourses: Course[] }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleEnroll() {
    if (!courseId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, courseId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to enroll client");
      }
      setOpen(false);
      setCourseId("");
      router.refresh();
    } catch (err) {
      showError(err, "clients.enroll");
    } finally {
      setSubmitting(false);
    }
  }

  if (availableCourses.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        Enroll in course
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select className="form-input" value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ width: 200 }}>
        <option value="">Choose a course…</option>
        {availableCourses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>
      <button className="btn btn-sm btn-primary" onClick={handleEnroll} disabled={!courseId || submitting}>
        {submitting ? "Enrolling…" : "Enroll"}
      </button>
      <button className="btn btn-sm" onClick={() => setOpen(false)} disabled={submitting}>
        Cancel
      </button>
    </div>
  );
}
