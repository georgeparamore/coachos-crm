"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { businessSlug, type Business } from "@/lib/businesses";
import { useErrorToast } from "@/components/error-toast-provider";

const COLORS = ["#7667e8", "#2b9a72", "#d1773f", "#3d7bb8", "#b34e72", "#697386", "#d4a72c", "#2b8a9e"];

function ColorStrip({ value, onChange, label }: { value: string; onChange: (color: string) => void; label: string }) {
  return (
    <div className="business-color-strip" role="radiogroup" aria-label={label}>
      {COLORS.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "is-selected" : ""}
          style={{ background: option }}
          role="radio"
          aria-checked={value === option}
          aria-label={`Choose ${option}`}
          onClick={() => onChange(option)}
        />
      ))}
    </div>
  );
}

export function BusinessManager({ initialBusinesses, coachId, embedded = false }: { initialBusinesses: Business[]; coachId: string; embedded?: boolean }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addBusiness(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const baseSlug = businessSlug(name);
      const slug = businesses.some((business) => business.slug === baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
      const { data, error } = await supabase.from("businesses").insert({ coach_id: coachId, name: name.trim(), slug, color, portal_name: name.trim(), is_default: businesses.length === 0 }).select().single();
      if (error) throw error;
      setBusinesses((items) => [...items, data as Business]);
      setName("");
      router.refresh();
    } catch (error) { showError(error, "settings.business-add"); }
    finally { setSaving(false); }
  }

  async function makeDefault(id: string) {
    try {
      const supabase = createClient();
      const { error: clearError } = await supabase.from("businesses").update({ is_default: false }).eq("coach_id", coachId).eq("is_default", true);
      if (clearError) throw clearError;
      const { error } = await supabase.from("businesses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      setBusinesses((items) => items.map((business) => ({ ...business, is_default: business.id === id })));
      router.refresh();
    } catch (error) { showError(error, "settings.business-default"); }
  }

  async function rename(business: Business) {
    const nextName = window.prompt("Business name", business.name)?.trim();
    if (!nextName || nextName === business.name) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("businesses").update({ name: nextName }).eq("id", business.id);
      if (error) throw error;
      setBusinesses((items) => items.map((item) => item.id === business.id ? { ...item, name: nextName } : item));
      router.refresh();
    } catch (error) { showError(error, "settings.business-rename"); }
  }

  async function updateColor(business: Business, nextColor: string) {
    if (nextColor === business.color) return;
    const previousColor = business.color;
    setBusinesses((items) => items.map((item) => item.id === business.id ? { ...item, color: nextColor } : item));
    try {
      const supabase = createClient();
      const { error } = await supabase.from("businesses").update({ color: nextColor }).eq("id", business.id);
      if (error) throw error;
      router.refresh();
    } catch (error) {
      setBusinesses((items) => items.map((item) => item.id === business.id ? { ...item, color: previousColor } : item));
      showError(error, "settings.business-color");
    }
  }

  async function editSchool(business: Business) {
    const portalName = window.prompt("Student-facing school name", business.portal_name || business.name)?.trim();
    if (!portalName) return;
    const portalTagline = window.prompt("School tagline", business.portal_tagline || "Learn, connect, and grow.")?.trim();
    if (portalTagline == null) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("businesses").update({ portal_name: portalName, portal_tagline: portalTagline }).eq("id", business.id);
      if (error) throw error;
      setBusinesses((items) => items.map((item) => item.id === business.id ? { ...item, portal_name: portalName, portal_tagline: portalTagline } : item));
      router.refresh();
    } catch (error) { showError(error, "settings.school-branding"); }
  }

  async function deleteBusiness(business: Business) {
    const confirmed = window.confirm(`Delete ${business.name}?\n\nThis permanently removes the business or brand. Empty test businesses can be deleted; businesses with linked CRM data are protected.`);
    if (!confirmed) return;
    setDeletingId(business.id);
    try {
      const response = await fetch(`/api/businesses/${business.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not delete that business");
      setBusinesses((items) => items.filter((item) => item.id !== business.id));
      router.refresh();
    } catch (error) { showError(error, "settings.business-delete"); }
    finally { setDeletingId(null); }
  }

  return (
    <div className={embedded ? "" : "card"}>
      {!embedded && <><div className="card-title">Businesses & brands</div><p className="sub" style={{ marginBottom: 14 }}>Keep every opportunity in one CRM while preserving which business it belongs to.</p></>}
      {businesses.map((business) => (
        <div className="list-row business-manager-row" key={business.id}>
          <div className="business-manager-identity">
            <div><div className="name">{business.name}</div><div className="sub">School: {business.portal_name || business.name} · /school/{business.slug}/login</div></div>
            <ColorStrip value={business.color} onChange={(nextColor) => void updateColor(business, nextColor)} label={`Color for ${business.name}`} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!business.is_default && <button className="btn btn-sm" type="button" onClick={() => makeDefault(business.id)}>Make default</button>}
            <a className="btn btn-sm" href={`/school/${business.slug}/login`} target="_blank" rel="noreferrer">Open school</a>
            <button className="btn btn-sm" type="button" onClick={() => editSchool(business)}>School branding</button>
            <button className="btn btn-sm" type="button" onClick={() => rename(business)}>Rename</button>
            {!business.is_default && <button className="btn btn-sm btn-danger" type="button" disabled={deletingId === business.id} onClick={() => deleteBusiness(business)}>{deletingId === business.id ? "Deleting…" : "Delete"}</button>}
          </div>
        </div>
      ))}
      <form onSubmit={addBusiness} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 14 }}>
        <label className="field" style={{ flex: "1 1 210px" }}><span>New business</span><input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Website Services" /></label>
        <label className="field"><span>Color</span><ColorStrip value={color} onChange={setColor} label="Color for new business" /></label>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "Add business"}</button>
      </form>
    </div>
  );
}
