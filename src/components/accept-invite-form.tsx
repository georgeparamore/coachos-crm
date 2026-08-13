"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AcceptInviteForm({
  token,
  email,
  defaultFullName,
  schoolSlug,
}: {
  token: string;
  email: string;
  defaultFullName: string;
  schoolSlug: string | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Flips to true when the invited email already has an account — the form
  // becomes "log in to accept" instead of "create an account".
  const [existingAccount, setExistingAccount] = useState(false);

  async function linkExistingAccount() {
    const res = await fetch("/api/invites/accept-existing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Failed to link your account to this coach");
    }
    router.push(schoolSlug ? `/school/${schoolSlug}/classroom` : "/dashboard");
    router.refresh();
  }

  async function handleCreateAccount(e: React.FormEvent) {
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
        if (body.code === "email_exists") {
          setExistingAccount(true);
          setPassword("");
          setError(null);
          return;
        }
        throw new Error(body.error || "Failed to create your account");
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Account was created successfully even if this sign-in call fails —
        // send them to log in manually rather than leaving them stuck here.
        router.push(schoolSlug ? `/school/${schoolSlug}/login` : "/login");
        return;
      }

      router.push(schoolSlug ? `/school/${schoolSlug}/classroom` : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error("Incorrect password for that account.");
      }
      await linkExistingAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (existingAccount) {
    return (
      <form onSubmit={handleLogin}>
        <div className="notes-box" style={{ marginBottom: 14 }}>
          An account already exists for {email}. Log in below to accept this invite — it&apos;ll link that account to
          your coach.
        </div>
        <div className="form-row">
          <label className="form-label">Email</label>
          <input className="form-input" value={email} disabled />
        </div>
        <div className="form-row">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            required
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
          {loading ? "Logging in…" : "Log in and accept"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCreateAccount}>
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
