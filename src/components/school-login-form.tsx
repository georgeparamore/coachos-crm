"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SchoolLoginForm({ businessId, slug }: { businessId: string; slug: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null); setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) { setError("That email or password is incorrect."); setLoading(false); return; }
    const { data: membership } = await supabase.from("coach_client_memberships").select("id").eq("business_id", businessId).eq("client_id", data.user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      await supabase.auth.signOut();
      setError("Your account does not have access to this school. Check your invite link or ask your coach.");
      setLoading(false); return;
    }
    router.push(`/school/${slug}/classroom`); router.refresh();
  }

  return <form onSubmit={submit}>
    <div className="form-row"><label className="form-label">Email</label><input className="form-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
    <div className="form-row"><label className="form-label">Password</label><input className="form-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    {error && <div className="notes-box" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>{error}</div>}
    <button className="btn btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", background: "var(--school-color)", borderColor: "var(--school-color)" }}>{loading ? "Signing in…" : "Enter school"}</button>
  </form>;
}
