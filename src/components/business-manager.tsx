"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { businessSlug, type Business } from "@/lib/businesses";
import { useErrorToast } from "@/components/error-toast-provider";

const COLORS = ["#7667e8", "#2b9a72", "#d1773f", "#3d7bb8", "#b34e72", "#697386"];

export function BusinessManager({ initialBusinesses, coachId }: { initialBusinesses: Business[]; coachId: string }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function addBusiness(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const baseSlug = businessSlug(name);
      const slug = businesses.some((business) => business.slug === baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
      const { data, error } = await supabase.from("businesses").insert({ coach_id: coachId, name: name.trim(), slug, color, is_default: businesses.length === 0 }).select().single();
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

  return (
    <div className="card">
      <div className="card-title">Businesses & brands</div>
      <p className="sub" style={{ marginBottom: 14 }}>Keep every opportunity in one CRM while preserving which business it belongs to.</p>
      {businesses.map((business) => (
        <div className="list-row" key={business.id}>
          <div className="list-row-left">
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 99, background: business.color, flex: "0 0 auto" }} />
            <div><div className="name">{business.name}</div><div className="sub">{business.is_default ? "Default for new leads" : "Separate lead pipeline available"}</div></div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {!business.is_default && <button className="btn btn-sm" type="button" onClick={() => makeDefault(business.id)}>Make default</button>}
            <button className="btn btn-sm" type="button" onClick={() => rename(business)}>Rename</button>
          </div>
        </div>
      ))}
      <form onSubmit={addBusiness} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 14 }}>
        <label className="field" style={{ flex: "1 1 210px" }}><span>New business</span><input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Website Services" /></label>
        <label className="field"><span>Color</span><select value={color} onChange={(event) => setColor(event.target.value)}>{COLORS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "Add business"}</button>
      </form>
    </div>
  );
}
