"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AcceptInviteForm({
  token,
  email,
  defaultFullName,
}: {
  token: string;
  email: string;
  defaultFullName: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to create your account");
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Account was created successfully even if this sign-in call fails —
        // send them to log in manually rather than leaving them stuck here.
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="form-label">Email</label>
        <input className="form-input" value={email} disabled />
      </div>
      <div className="form-row">
        <label className="form-label">Your name</label>
        <input className="form-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="form-row">
        <label className="form-label">Set a password</label>
        <input
          className="form-input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div className="notes-box" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
          {error}
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
