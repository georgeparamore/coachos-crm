"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LeadFormModal } from "@/components/lead-form-modal";
import { EventFormModal } from "@/components/event-form-modal";
import type { Lead, LeadInput } from "@/lib/leads";
import type { EventType } from "@/lib/events";
import { useErrorToast } from "@/components/error-toast-provider";

type QuickAction = "lead" | "appointment" | "client" | null;

export function QuickAdd({ coachId }: { coachId: string }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<QuickAction>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  function close() {
    setAction(null);
    setOpen(false);
  }

  async function openAppointment() {
    setOpen(false);
    setAction("appointment");
    const supabase = createClient();
    const { data } = await supabase.from("leads").select("*").eq("coach_id", coachId).order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
  }

  async function saveLead(input: LeadInput) {
    const supabase = createClient();
    const { error } = await supabase.from("leads").insert({ ...input, coach_id: coachId });
    if (error) throw error;
    close();
    router.refresh();
  }

  async function saveEvent(input: {
    title: string;
    description: string;
    event_type: EventType;
    start_time: string;
    end_time: string | null;
    location: string;
    lead_id: string | null;
    client_id: string | null;
  }) {
    const supabase = createClient();
    const { error } = await supabase.from("events").insert({ ...input, coach_id: coachId });
    if (error) throw error;
    close();
    router.refresh();
  }

  async function inviteClient(event: React.FormEvent) {
    event.preventDefault();
    setSavingClient(true);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clientEmail, fullName: clientName || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Failed to invite client");
      setClientEmail("");
      setClientName("");
      close();
      router.refresh();
    } catch (error) {
      showError(error, "quick-add.client-invite");
    } finally {
      setSavingClient(false);
    }
  }

  return (
    <>
      <div className="quick-add-wrap">
        {open && (
          <div className="quick-add-menu">
            <div className="quick-add-label">Create new</div>
            <button onClick={() => { setOpen(false); setAction("lead"); }}><span>↗</span><div><strong>Lead</strong><small>Add someone to your pipeline</small></div></button>
            <button onClick={openAppointment}><span>□</span><div><strong>Appointment</strong><small>Schedule a call or session</small></div></button>
            <button onClick={() => { setOpen(false); setAction("client"); }}><span>+</span><div><strong>Client invite</strong><small>Invite someone to your workspace</small></div></button>
          </div>
        )}
        <button className={`quick-add-button${open ? " is-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-label="Quick add" aria-expanded={open}>
          <span>+</span> Quick add
        </button>
      </div>

      {action === "lead" && <LeadFormModal lead={null} onClose={close} onSave={saveLead} />}
      {action === "appointment" && (
        <EventFormModal event={null} defaultDate={new Date()} leads={leads} onClose={close} onSave={saveEvent} />
      )}
      {action === "client" && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-eyebrow">New relationship</div>
            <div className="card-title">Invite a client</div>
            <p className="sub" style={{ marginBottom: 20 }}>They’ll receive a secure link to create their client account.</p>
            <form onSubmit={inviteClient}>
              <div className="form-row"><label className="form-label">Name</label><input className="form-input" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" /></div>
              <div className="form-row"><label className="form-label">Email</label><input className="form-input" type="email" required value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="client@example.com" /></div>
              <div className="modal-actions"><button className="btn btn-primary" disabled={savingClient}>{savingClient ? "Sending…" : "Send invitation"}</button><button className="btn" type="button" onClick={close}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
