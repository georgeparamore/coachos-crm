"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LEAD_STAGES, type Lead, type LeadInput } from "@/lib/leads";
import { LeadFormModal } from "@/components/lead-form-modal";
import { useErrorToast } from "@/components/error-toast-provider";
import type { Business } from "@/lib/businesses";

export function CrmBoard({
  initialLeads,
  businesses,
  coachId,
  initialLeadId,
  initialCreate,
}: {
  initialLeads: Lead[];
  businesses: Business[];
  coachId: string;
  initialLeadId?: string;
  initialCreate?: boolean;
}) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [leads, setLeads] = useState(initialLeads);
  const [editingLead, setEditingLead] = useState<Lead | null | undefined>(() =>
    initialCreate ? null : initialLeadId ? initialLeads.find((l) => l.id === initialLeadId) : undefined,
  );
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [businessFilter, setBusinessFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const businessById = new Map(businesses.map((business) => [business.id, business]));
  const visibleLeads = leads.filter((lead) => {
    if (businessFilter !== "all" && lead.business_id !== businessFilter) return false;
    if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || [lead.name, lead.email, lead.phone, lead.business_name, lead.service_interest].some((value) => value?.toLowerCase().includes(query));
  });
  const sources = Array.from(new Set(leads.map((lead) => lead.source).filter((value): value is string => Boolean(value)))).sort();

  useEffect(() => {
    if (initialLeadId || initialCreate) router.replace("/crm");
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
    const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", editingLead.id);
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
    await supabase.from("lead_activities").insert({ coach_id: coachId, lead_id: leadId, activity_type: "status_changed", note: `Status changed to ${LEAD_STAGES.find((item) => item.key === stage)?.label ?? stage}`, metadata: { from: lead.stage, to: stage } });
    setMovingLeadId(null);
    router.refresh();
  }

  async function convertLead() {
    if (!editingLead?.email) throw new Error("Add an email address before converting this lead.");
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editingLead.email, fullName: editingLead.name, businessId: editingLead.business_id }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 409) throw new Error(body.error || "Failed to create client invitation");
    await moveLead(editingLead.id, "won");
    setEditingLead(undefined);
    router.push("/clients");
  }

  async function logContact(type: "call" | "email" | "text") {
    if (!editingLead) return;
    const occurredAt = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.from("lead_activities").insert({ coach_id: coachId, lead_id: editingLead.id, activity_type: type, occurred_at: occurredAt });
    if (error) {
      showError(error, "crm.contact-log");
      return;
    }
    const nextStage = editingLead.stage === "new" ? "in_conversation" : editingLead.stage;
    setLeads((items) => items.map((item) => item.id === editingLead.id ? { ...item, stage: nextStage, last_contacted_at: occurredAt } : item));
    setEditingLead((lead) => lead ? { ...lead, stage: nextStage, last_contacted_at: occurredAt } : lead);
    if (nextStage !== editingLead.stage) await supabase.from("leads").update({ stage: nextStage }).eq("id", editingLead.id);
    router.refresh();
  }

  const isClosed = (lead: Lead) => ["signed", "won", "lost", "spam_disqualified"].includes(lead.stage);
  const openPipelineValue = visibleLeads
    .filter((lead) => !isClosed(lead))
    .reduce((total, lead) => total + (lead.value_cents ?? 0), 0);

  return (
    <>
      <div className="pipeline-toolbar">
        <div className="pipeline-summary">
          <span><strong>{visibleLeads.filter((lead) => !isClosed(lead)).length}</strong> open leads</span>
          <span><strong>${(openPipelineValue / 100).toLocaleString()}</strong> monthly pipeline</span>
          <span><strong>{visibleLeads.filter((lead) => lead.stage === "signed" || lead.stage === "won").length}</strong> converted</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="form-input" aria-label="Search leads" placeholder="Search leads…" value={search} onChange={(event) => setSearch(event.target.value)} style={{ minWidth: 190 }} />
          <select className="form-input" aria-label="Filter by business" value={businessFilter} onChange={(event) => setBusinessFilter(event.target.value)} style={{ minWidth: 180 }}>
            <option value="all">All businesses</option>
            {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
          </select>
          <select className="form-input" aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} style={{ minWidth: 160 }}><option value="all">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select>
          <button className="btn btn-primary" onClick={() => setEditingLead(null)}>Add lead</button>
        </div>
      </div>

      <div className="pipeline-wrap">
        {LEAD_STAGES.map((stage) => {
          const stageLeads = visibleLeads.filter((l) => l.stage === stage.key);
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
                  <a href={`/crm/${lead.id}`} onClick={(event) => event.stopPropagation()} className="sub" style={{ float: "right" }}>Details →</a>
                  {businessById.get(lead.business_id) && <div className="business-chip"><span style={{ background: businessById.get(lead.business_id)!.color }} />{businessById.get(lead.business_id)!.name}</div>}
                  <div className="pipeline-card-meta">
                    {[lead.service_interest, lead.source, lead.value_cents != null ? `$${lead.value_cents / 100}/mo` : null]
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
          businesses={businesses}
          defaultBusinessId={businessFilter !== "all" ? businessFilter : businesses.find((business) => business.is_default)?.id ?? businesses[0]?.id ?? ""}
          onClose={() => setEditingLead(undefined)}
          onSave={handleSave}
          onDelete={editingLead ? handleDelete : undefined}
          onConvert={editingLead ? convertLead : undefined}
          onContact={editingLead ? logContact : undefined}
        />
      )}
    </>
  );
}
