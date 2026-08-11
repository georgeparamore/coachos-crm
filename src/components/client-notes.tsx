"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useErrorToast } from "@/components/error-toast-provider";

export type ClientNote = { id: string; body: string; created_at: string };

export function ClientNotes({ coachId, clientId, initialNotes }: { coachId: string; clientId: string; initialNotes: ClientNote[] }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("client_notes")
        .insert({ coach_id: coachId, client_id: clientId, body: trimmed })
        .select("id, body, created_at")
        .single();
      if (error) throw error;
      setNotes((current) => [data as ClientNote, ...current]);
      setBody("");
      router.refresh();
    } catch (error) {
      showError(error, "clients.note-create");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    const previous = notes;
    setNotes((current) => current.filter((note) => note.id !== noteId));
    const supabase = createClient();
    const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
    if (error) {
      setNotes(previous);
      showError(error, "clients.note-delete");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card client-notes-card">
      <div className="card-title">Private coaching notes</div>
      <form onSubmit={addNote}>
        <textarea className="form-input" rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add context, goals, or a note from your latest session…" />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={saving || !body.trim()}>{saving ? "Saving…" : "Add note"}</button>
        </div>
      </form>
      <div className="client-note-list">
        {notes.length === 0 ? <div className="sub">No private notes yet.</div> : notes.map((note) => (
          <article className="client-note" key={note.id}>
            <p>{note.body}</p>
            <footer><span>{new Date(note.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><button onClick={() => void deleteNote(note.id)} aria-label="Delete note">Delete</button></footer>
          </article>
        ))}
      </div>
    </div>
  );
}
