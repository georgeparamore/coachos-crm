"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/lib/businesses";
import { useErrorToast } from "@/components/error-toast-provider";

type Integration = { id: string; business_id: string; zoom_account_id: string; host_email: string | null; enabled: boolean };

export function ZoomDiscoveryIntegration({ businesses, integration, credentialsReady }: { businesses: Business[]; integration: Integration | null; credentialsReady: boolean }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const defaultBusiness = businesses.find((business) => business.slug === "full-circle") ?? businesses.find((business) => business.name.toLowerCase().includes("website")) ?? businesses[0];

  async function save(formData: FormData) {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/zoom/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not save the Zoom routing");
      setSaved(true);
      router.refresh();
    } catch (error) { showError(error, "settings.zoom-discovery"); }
    finally { setSaving(false); }
  }

  const ready = Boolean(integration?.enabled && credentialsReady);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div><div className="card-title">Zoom discovery calls</div><p className="sub">Automatically turn completed Zoom recordings into transcripts and build-ready project briefs.</p></div>
        <span className={`badge ${ready ? "badge-green" : "badge-amber"}`}>{ready ? "Ready" : "Setup needed"}</span>
      </div>
      <div className="notes-box zoom-webhook-box">
        <strong>Webhook URL</strong>
        <code>https://coachos-drab.vercel.app/api/zoom/webhook</code>
      </div>
      <form action={save}>
        <div className="zoom-setup-form">
          <label className="zoom-setup-field">
            <span className="form-label">Send completed calls to</span>
            <select className="form-input" name="businessId" required defaultValue={integration?.business_id ?? defaultBusiness?.id}>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
            <small>The business whose leads and project calls these recordings belong to.</small>
          </label>
          <label className="zoom-setup-field">
            <span className="form-label">Zoom Account ID</span>
            <input className="form-input" name="zoomAccountId" required defaultValue={integration?.zoom_account_id ?? ""} placeholder="Paste the Account ID from Zoom" />
            <small>Find this in your Zoom Server-to-Server OAuth app under App Credentials.</small>
          </label>
          <label className="zoom-setup-field">
            <span className="form-label">Zoom host email <span>(optional)</span></span>
            <input className="form-input" name="hostEmail" type="email" defaultValue={integration?.host_email ?? ""} placeholder="dejuan@example.com" />
            <small>Add the email used to host discovery calls, or leave this blank.</small>
          </label>
        </div>
        <div className="zoom-setup-actions">
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : integration ? "Update Zoom routing" : "Save Zoom routing"}</button>
          {saved && <span className="zoom-saved-message">Saved ✓</span>}
        </div>
      </form>
      {!credentialsReady && <p className="sub" style={{ marginTop: 12 }}>The Zoom and OpenAI secret credentials still need to be added in Vercel before automatic processing can run.</p>}
    </div>
  );
}
