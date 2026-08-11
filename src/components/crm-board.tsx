"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STAGES, type Lead, type LeadInput } from "@/lib/leads";
import { LeadFormModal } from "@/components/lead-form-modal";
import { useErrorToast } from "@/components/error-toast-provider";

export function CrmBoard({
  initialLeads,
  coachId,
  initialLeadId,
}: {
  initialLeads: Lead[];
  coachId: string;
  initialLeadId?: string;
}) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [leads, setLeads] = useState(initialLeads);
  const [editingLead, setEditingLead] = useState<Lead | null | undefined>(() =>
    initialLeadId ? initialLeads.find((l) => l.id === initialLeadId) : undefined,
  );
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (initialLeadId) router.replace("/crm");
    // Only meant to run once, to clean up the URL param this page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(input: LeadInput) {
    const supabase = createClient();

    if (editingLead) {
      const { data, error } = await supabase
        .from("leads")
        .update(input)
        .eq("id", editingLead.id)
        .select()
        .single();
      if (error) throw error;
      setLeads((prev) => prev.map((l) => (l.id === data.id ? (data as Lead) : l)));
    } else {
      const { data, error } = await supabase
        .from("leads")
        .insert({ ...input, coach_id: coachId })
        .select()
        .single();
      if (error) throw error;
      setLeads((prev) => [data as Lead, ...prev]);
    }

    setEditingLead(undefined);
    router.refresh();
  }

  async function handleDelete() {
    if (!editingLead) return;
    const supabase = createClient();
    const { error } = await supabase.from("leads").delete().eq("id", editingLead.id);
    if (error) throw error;
    setLeads((prev) => prev.filter((l) => l.id !== editingLead.id));
    setEditingLead(undefined);
    router.refresh();
  }

  async function moveLead(leadId: string, stage: Lead["stage"]) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stage === stage) return;
    const previous = leads;
    setMovingLeadId(leadId);
    setLeads((items) => items.map((item) => item.id === leadId ? { ...item, stage } : item));
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
    if (error) {
      setLeads(previous);
      setMovingLeadId(null);
      throw error;
    }
    setMovingLeadId(null);
    router.refresh();
  }

  async function convertLead() {
    if (!editingLead?.email) throw new Error("Add an email address before converting this lead.");
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editingLead.email, fullName: editingLead.name }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 409) throw new Error(body.error || "Failed to create client invitation");
    await moveLead(editingLead.id, "signed");
    setEditingLead(undefined);
    router.push("/clients");
  }

  const openPipelineValue = leads
    .filter((lead) => lead.stage !== "signed")
    .reduce((total, lead) => total + (lead.value_cents ?? 0), 0);

  return (
    <>
      <div className="pipeline-toolbar">
        <div className="pipeline-summary">
          <span><strong>{leads.filter((lead) => lead.stage !== "signed").length}</strong> open leads</span>
          <span><strong>${(openPipelineValue / 100).toLocaleString()}</strong> monthly pipeline</span>
          <span><strong>{leads.filter((lead) => lead.stage === "signed").length}</strong> converted</span>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingLead(null)}>
          Add lead
        </button>
      </div>

      <div className="pipeline-wrap">
        {LEAD_STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          return (
            <div
              className="pipeline-col"
              key={stage.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const leadId = event.dataTransfer.getData("text/lead-id");
                if (leadId) void moveLead(leadId, stage.key).catch((error) => showError(error, "crm.lead-move"));
              }}
            >
              <div className="pipeline-col-header">
                {stage.label} <span className={`badge ${stage.badge}`}>{stageLeads.length}</span>
              </div>
              {stageLeads.map((lead) => (
                <div
                  className={`pipeline-card${movingLeadId === lead.id ? " is-moving" : ""}`}
                  key={lead.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/lead-id", lead.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => setEditingLead(lead)}
                >
                  <div className="pipeline-card-name">{lead.name}</div>
                  <div className="pipeline-card-meta">
                    {[lead.source, lead.value_cents != null ? `$${lead.value_cents / 100}/mo` : null]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {lead.fit_score != null && <span className="badge badge-blue">Fit {lead.fit_score}/10</span>}
                    {lead.follow_up_at && lead.stage !== "signed" && (
                      <span className={`badge ${new Date(lead.follow_up_at) < new Date() ? "badge-red" : "badge-amber"}`}>
                        {new Date(lead.follow_up_at) < new Date() ? "Overdue" : `Next ${new Date(lead.follow_up_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {stageLeads.length === 0 && (
                <div className="sub" style={{ padding: "8px 0" }}>
                  No leads in this stage
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingLead !== undefined && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => setEditingLead(undefined)}
          onSave={handleSave}
          onDelete={editingLead ? handleDelete : undefined}
          onConvert={editingLead ? convertLead : undefined}
        />
      )}
    </>
  );
}
