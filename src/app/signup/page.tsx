"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthShell tagline="Set up your coaching business in minutes.">
      <div className="logo-name" style={{ marginBottom: 2 }}>
        Full Circle CRM
      </div>
      <div className="page-sub" style={{ marginBottom: 20 }}>
        Create your coach account
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="form-label">Your name</label>
          <input
            className="form-input"
            required
            autoComplete="name"
            placeholder="Jordan Blake"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="form-label">Password</label>
          <div style={{ position: "relative" }}>
            <input
              className="form-input"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 60 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="sub"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="auth-field-hint">At least 6 characters</div>
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
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
