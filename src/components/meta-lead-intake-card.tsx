"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";
import type { Business } from "@/lib/businesses";

type Source = { id: string; business_id: string; meta_page_id: string; page_name: string | null; meta_form_id: string | null; form_name: string | null; meta_ad_account_id?: string | null; last_received_at: string | null };

type Health = { processed: number; failed: number; unmapped: number; lastEventAt: string | null };

export function MetaLeadIntakeCard({ sources, businesses, health, webhookReady, verifyToken }: { sources: Source[]; businesses: Business[]; health: Health; webhookReady: boolean; verifyToken: string | null }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [saving, setSaving] = useState(false);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(() => new Set());

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

  async function sendTest(sourceId: string) {
    try {
      const res = await fetch("/api/meta/test-lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't create the test lead");
      router.push(`/crm?lead=${body.leadId}`);
      router.refresh();
    } catch (error) { showError(error, "settings.meta-test-lead"); }
  }

  async function retryFailed() {
    try {
      const res = await fetch("/api/meta/retry", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't retry failed deliveries");
      router.refresh();
    } catch (error) { showError(error, "settings.meta-retry"); }
  }

  async function subscribe(sourceId: string) {
    setSubscribingId(sourceId);
    try {
      const res = await fetch("/api/meta/lead-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Meta could not subscribe this Page");
      setSubscribedIds((current) => new Set(current).add(sourceId));
      router.refresh();
    } catch (error) { showError(error, "settings.meta-subscribe-page"); }
    finally { setSubscribingId(null); }
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

      <div className="meta-health-grid">
        <div><strong>{health.processed}</strong><span>received</span></div>
        <div className={health.failed ? "has-error" : ""}><strong>{health.failed}</strong><span>failed</span></div>
        <div className={health.unmapped ? "has-warning" : ""}><strong>{health.unmapped}</strong><span>unmapped</span></div>
      </div>
      {(health.failed > 0 || health.unmapped > 0) && <div className="notes-box" style={{ background: "var(--amber-bg)", color: "var(--amber-text)", marginBottom: 14 }}>Some Meta submissions need attention. Failed events usually indicate a token or permission problem; unmapped events need the correct Page/Form mapping below.{health.failed > 0 && <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={retryFailed}>Retry failed deliveries</button>}</div>}
      {health.lastEventAt && <p className="sub" style={{ marginBottom: 12 }}>Last webhook activity: {new Date(health.lastEventAt).toLocaleString()}</p>}

      {sources.map((source) => (
        <div className="list-row" key={source.id}>
          <div><div className="name">{source.page_name || `Page ${source.meta_page_id}`}</div><div className="sub">{businesses.find((business) => business.id === source.business_id)?.name ?? "Business"} · {source.form_name || (source.meta_form_id ? `Form ${source.meta_form_id}` : "All Instant Forms")}{source.last_received_at ? ` · Last lead ${new Date(source.last_received_at).toLocaleString()}` : " · Waiting for first lead"}</div></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="btn btn-sm" disabled={subscribingId === source.id || subscribedIds.has(source.id)} onClick={() => subscribe(source.id)}>{subscribingId === source.id ? "Subscribing…" : subscribedIds.has(source.id) ? "Page subscribed ✓" : "Subscribe Page"}</button><button className="btn btn-sm" onClick={() => sendTest(source.id)}>Send test lead</button><button className="btn btn-sm" onClick={() => remove(source.id)}>Remove</button></div>
        </div>
      ))}

      <form action={submit} style={{ marginTop: 16 }}>
        <div className="form-grid">
          <label className="field"><span>Business</span><select name="businessId" required defaultValue={businesses.find((business) => business.is_default)?.id ?? businesses[0]?.id}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label className="field"><span>Facebook Page ID</span><input name="pageId" inputMode="numeric" required defaultValue="1027598377108811" placeholder="1234567890" /></label>
          <label className="field"><span>Page name</span><input name="pageName" defaultValue="Happy dejuan" placeholder="Your business page" /></label>
          <label className="field"><span>Ad account ID</span><input name="adAccountId" inputMode="numeric" defaultValue="153302168076882" placeholder="153302168076882" /></label>
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
