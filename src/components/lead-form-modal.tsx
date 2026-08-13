"use client";

import { useState } from "react";
import { LEAD_STAGES, type Lead, type LeadInput, type LeadStage } from "@/lib/leads";
import { getErrorMessage } from "@/lib/errors";
import { useErrorToast } from "@/components/error-toast-provider";
import type { Business } from "@/lib/businesses";

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Props = {
  lead: Lead | null;
  onClose: () => void;
  onSave: (input: LeadInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onConvert?: () => Promise<void>;
  onContact?: (type: "call" | "email" | "text") => Promise<void>;
  businesses: Business[];
  defaultBusinessId: string;
};

export function LeadFormModal({ lead, onClose, onSave, onDelete, onConvert, onContact, businesses, defaultBusinessId }: Props) {
  const [name, setName] = useState(lead?.name ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [source, setSource] = useState(lead?.source ?? "");
  const [businessId, setBusinessId] = useState(lead?.business_id ?? defaultBusinessId);
  const [serviceInterest, setServiceInterest] = useState(lead?.service_interest ?? "");
  const [stage, setStage] = useState<LeadStage>(lead?.stage ?? "new");
  const [value, setValue] = useState(lead?.value_cents != null ? String(lead.value_cents / 100) : "");
  const [fitScore, setFitScore] = useState(lead?.fit_score != null ? String(lead.fit_score) : "");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [followUpAt, setFollowUpAt] = useState(toLocalDateTime(lead?.follow_up_at));
  const [businessName, setBusinessName] = useState(lead?.business_name ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(lead?.website_url ?? "");
  const [projectType, setProjectType] = useState<"new_website" | "redesign" | "other" | "">(lead?.project_type ?? "");
  const [businessDescription, setBusinessDescription] = useState(lead?.business_description ?? "");
  const [launchTimeframe, setLaunchTimeframe] = useState(lead?.launch_timeframe ?? "");
  const [budgetSetAside, setBudgetSetAside] = useState(lead?.budget_set_aside ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useErrorToast();
  const attribution = lead?.source_details ?? {};
  const attributionRows = [
    ["Campaign", attribution.campaign_name],
    ["Ad", attribution.ad_name],
    ["Form", attribution.form_name],
    ["Page", attribution.page_name],
  ].filter((row): row is [string, string] => typeof row[1] === "string" && row[1].length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        business_id: businessId,
        name,
        email,
        phone,
        source,
        service_interest: serviceInterest,
        stage,
        value_cents: value ? Math.round(parseFloat(value) * 100) : null,
        fit_score: fitScore ? parseInt(fitScore, 10) : null,
        notes,
        follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
        business_name: businessName, website_url: websiteUrl, project_type: projectType || null,
        business_description: businessDescription, launch_timeframe: launchTimeframe, budget_set_aside: budgetSetAside,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      showError(err, "crm.lead-save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-eyebrow">{lead ? "Lead record" : "Pipeline"}</div>
        <div className="card-title">{lead ? "Edit lead" : "Add lead"}</div>
        {lead && (
          <div className="lead-action-strip">
            {lead.email && <a className="btn btn-sm" href={`mailto:${lead.email}`} onClick={() => void onContact?.("email")}>Email</a>}
            {lead.phone && <a className="btn btn-sm" href={`tel:${lead.phone}`} onClick={() => void onContact?.("call")}>Call</a>}
            {lead.phone && <a className="btn btn-sm" href={`sms:${lead.phone}`} onClick={() => void onContact?.("text")}>Text</a>}
            <a className="btn btn-sm" href={`/calendar?lead=${lead.id}`}>Schedule follow-up</a>
            {onConvert && lead.stage !== "signed" && (
              <button className="btn btn-sm btn-accent" type="button" disabled={saving} onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  await onConvert();
                } catch (err) {
                  setError(getErrorMessage(err));
                  showError(err, "crm.lead-convert");
                } finally {
                  setSaving(false);
                }
              }}>Convert to client</button>
            )}
          </div>
        )}
        {lead?.last_contacted_at && <div className="sub" style={{ margin: "-4px 0 14px" }}>Last contacted {new Date(lead.last_contacted_at).toLocaleString()}</div>}
        {attributionRows.length > 0 && (
          <div className="notes-box" style={{ marginBottom: 16 }}>
            <div className="name" style={{ marginBottom: 6 }}>Original attribution</div>
            {attributionRows.map(([label, value]) => <div className="sub" key={label}><strong>{label}:</strong> {value}</div>)}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Business</label>
            <select className="form-input" required value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Service or interest</label>
            <input className="form-input" placeholder="Custom website, coaching, ad management…" value={serviceInterest} onChange={(event) => setServiceInterest(event.target.value)} />
          </div>
          <div className="form-grid"><label className="field"><span>Business name</span><input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label><label className="field"><span>Website URL</span><input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /></label></div>
          <div className="form-grid"><label className="field"><span>Project type</span><select value={projectType} onChange={(e) => setProjectType(e.target.value as typeof projectType)}><option value="">Not specified</option><option value="new_website">New website</option><option value="redesign">Redesign</option><option value="other">Other</option></select></label><label className="field"><span>Budget set aside</span><input value={budgetSetAside} onChange={(e) => setBudgetSetAside(e.target.value)} /></label></div>
          <div className="form-grid"><label className="field"><span>Desired launch timeframe</span><input value={launchTimeframe} onChange={(e) => setLaunchTimeframe(e.target.value)} /></label><label className="field"><span>What the business offers</span><input value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} /></label></div>
          <div className="form-row">
            <label className="form-label">Name</label>
            <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Phone</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Source</label>
            <input
              className="form-input"
              placeholder="Website form, Instagram, referral…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Stage</label>
            <select className="form-input" value={stage} onChange={(e) => setStage(e.target.value as LeadStage)}>
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Deal value ($/mo)</label>
            <input className="form-input" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Fit score (0–10)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="10"
              value={fitScore}
              onChange={(e) => setFitScore(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Next follow-up</label>
            <input className="form-input" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onDelete();
                  } catch (err) {
                    setError(getErrorMessage(err));
                    showError(err, "crm.lead-delete");
                  } finally {
                    setSaving(false);
                  }
                }}
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
