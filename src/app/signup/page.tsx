"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "coach", full_name: fullName },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNotice("Check your inbox to confirm your email, then sign in.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div className="card" style={{ width: 380, marginBottom: 0 }}>
        <div className="logo-name" style={{ marginBottom: 2 }}>
          DJS CRM
        </div>
        <div className="page-sub" style={{ marginBottom: 20 }}>
          Create your coach account
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Your name</label>
            <input className="form-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && (
            <div className="notes-box" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
              {error}
            </div>
          )}
          {notice && <div className="notes-box">{notice}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="sub" style={{ marginTop: 14, textAlign: "center" }}>
          Already have an account? <Link href="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
