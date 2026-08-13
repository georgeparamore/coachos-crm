"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";
import type { Business } from "@/lib/businesses";

type Source = { id: string; business_id: string; meta_page_id: string; page_name: string | null; meta_form_id: string | null; form_name: string | null; last_received_at: string | null };

export function MetaLeadIntakeCard({ sources, businesses, webhookReady, verifyToken }: { sources: Source[]; businesses: Business[]; webhookReady: boolean; verifyToken: string | null }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/meta/lead-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't save lead intake");
      router.refresh();
    } catch (error) { showError(error, "settings.meta-lead-intake"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/meta/lead-source?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove mapping");
      router.refresh();
    } catch (error) { showError(error, "settings.meta-lead-intake-remove"); }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="card-title">Instant Form lead intake</div>
          <div className="sub">Send Facebook and Instagram form submissions straight into your New leads column.</div>
        </div>
        <span className={`badge ${webhookReady && sources.length ? "badge-green" : "badge-amber"}`}>{webhookReady && sources.length ? "Ready" : "Setup needed"}</span>
      </div>

      <div style={{ margin: "16px 0", padding: 14, borderRadius: 12, background: "var(--surface-2, var(--bg))" }}>
        <div className="name" style={{ marginBottom: 8 }}>Launch checklist</div>
        <div className="sub">{webhookReady ? "✓" : "○"} Secure webhook configured</div>
        <div className="sub">{sources.length ? "✓" : "○"} Facebook Page/form mapped</div>
        <div className="sub">{sources.some((source) => source.last_received_at) ? "✓" : "○"} Test lead received</div>
      </div>

      {sources.map((source) => (
        <div className="list-row" key={source.id}>
          <div><div className="name">{source.page_name || `Page ${source.meta_page_id}`}</div><div className="sub">{businesses.find((business) => business.id === source.business_id)?.name ?? "Business"} · {source.form_name || (source.meta_form_id ? `Form ${source.meta_form_id}` : "All Instant Forms")}{source.last_received_at ? ` · Last lead ${new Date(source.last_received_at).toLocaleString()}` : " · Waiting for first lead"}</div></div>
          <button className="btn btn-sm" onClick={() => remove(source.id)}>Remove</button>
        </div>
      ))}

      <form action={submit} style={{ marginTop: 16 }}>
        <div className="form-grid">
          <label className="field"><span>Business</span><select name="businessId" required defaultValue={businesses.find((business) => business.is_default)?.id ?? businesses[0]?.id}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label className="field"><span>Facebook Page ID</span><input name="pageId" inputMode="numeric" required placeholder="1234567890" /></label>
          <label className="field"><span>Page name</span><input name="pageName" placeholder="Your business page" /></label>
          <label className="field"><span>Instant Form ID (optional)</span><input name="formId" inputMode="numeric" placeholder="Leave blank for all forms" /></label>
          <label className="field"><span>Form name</span><input name="formName" placeholder="Website quote form" /></label>
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Add lead source"}</button>
      </form>
      <p className="sub" style={{ marginTop: 12 }}>Meta callback URL: <code>https://coachos-drab.vercel.app/api/meta/webhook</code></p>
      {verifyToken && <p className="sub">Verify token: <code>{verifyToken}</code></p>}
      <p className="sub">In your Meta app, add those under Webhooks → Page, then subscribe the Page object to the <code>leadgen</code> field.</p>
    </div>
  );
}
