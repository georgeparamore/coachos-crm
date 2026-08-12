"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NavIcon } from "@/components/nav-icon";
import { useErrorToast } from "@/components/error-toast-provider";

export type CourseClient = { id: string; full_name: string | null; email: string };

export function CourseEnrollmentModal({ courseId, courseTitle, clients, initialClientIds, progressByClientId, onClose, onSaved }: {
  courseId: string;
  courseTitle: string;
  clients: CourseClient[];
  initialClientIds: string[];
  progressByClientId: Record<string, number>;
  onClose: () => void;
  onSaved: (clientIds: string[]) => void;
}) {
  const { showError } = useErrorToast();
  const [selected, setSelected] = useState(() => new Set(initialClientIds));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? clients.filter((client) => `${client.full_name ?? ""} ${client.email}`.toLowerCase().includes(search)) : clients;
  }, [clients, query]);

  function toggle(clientId: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(clientId)) next.delete(clientId); else next.add(clientId); return next; });
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/enrollments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, clientIds: Array.from(selected) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update enrollments");
      onSaved(Array.from(selected));
    } catch (error) { showError(error, "courses.enrollments-save"); } finally { setSaving(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div aria-labelledby="enrollment-title" aria-modal="true" className="modal course-enrollment-modal" role="dialog">
      <div className="modal-header"><div><span className="modal-eyebrow">Course access</span><h2 id="enrollment-title">Manage students</h2><p>{courseTitle}</p></div><button aria-label="Close" className="icon-btn" onClick={onClose}><NavIcon name="x" /></button></div>
      {clients.length ? <>
        <div className="course-enrollment-tools"><div className="search-field"><NavIcon name="search" /><input aria-label="Search clients" placeholder="Search clients" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span>{selected.size} enrolled</span></div>
        <div className="course-enrollment-list">{filtered.map((client) => <label className={`course-enrollment-row${selected.has(client.id) ? " selected" : ""}`} key={client.id}><input checked={selected.has(client.id)} onChange={() => toggle(client.id)} type="checkbox" /><span className="course-enrollment-avatar">{(client.full_name || client.email).charAt(0).toUpperCase()}</span><span><strong>{client.full_name || client.email}</strong><small>{client.email}</small></span><b>{selected.has(client.id) ? `${progressByClientId[client.id] ?? 0}% complete` : "Not enrolled"}</b></label>)}{filtered.length === 0 && <div className="course-enrollment-empty">No clients match that search.</div>}</div>
      </> : <div className="course-enrollment-empty"><NavIcon name="users" /><strong>No active clients yet</strong><p>Invite a client first, then return here to grant course access.</p><Link className="btn btn-primary" href="/clients#invite">Invite a client</Link></div>}
      <div className="modal-actions"><button className="btn" onClick={onClose}>Cancel</button>{clients.length > 0 && <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save enrollments"}</button>}</div>
    </div>
  </div>;
}
