"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

type LeadOption = { id: string; name: string; email: string | null };

export function DiscoveryCallActions({ callId, currentLeadId, leads, canRetry, canReprocess = false }: { callId: string; currentLeadId: string | null; leads: LeadOption[]; canRetry: boolean; canReprocess?: boolean }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [leadId, setLeadId] = useState(currentLeadId ?? "");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function saveLead() {
    setSaving(true);
    try {
      const response = await fetch(`/api/discovery-calls/${callId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: leadId || null }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not link this call");
      router.refresh();
    } catch (error) { showError(error, "discovery-call.link-lead"); }
    finally { setSaving(false); }
  }

  async function retry() {
    setRetrying(true);
    try {
      const response = await fetch(`/api/discovery-calls/${callId}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not retry this call");
      router.refresh();
    } catch (error) { showError(error, "discovery-call.retry"); }
    finally { setRetrying(false); }
  }

  return <div className="card"><div className="card-title">CRM connection</div><p className="sub" style={{ marginBottom: 12 }}>Link the conversation to the opportunity it belongs to.</p><label className="field"><span>Lead</span><select value={leadId} onChange={(event) => setLeadId(event.target.value)}><option value="">Not linked yet</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}{lead.email ? ` · ${lead.email}` : ""}</option>)}</select></label><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn btn-primary" onClick={saveLead} disabled={saving}>{saving ? "Saving…" : "Save link"}</button>{(canRetry || canReprocess) && <button className="btn" onClick={retry} disabled={retrying}>{retrying ? "Processing…" : canReprocess ? "Reprocess transcript" : "Retry processing"}</button>}</div>{canReprocess && <p className="sub" style={{ margin: "10px 0 0" }}>Adds speaker labels and timestamps to this earlier transcript.</p>}</div>;
}
