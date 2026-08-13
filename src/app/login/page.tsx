"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth-shell";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function signIn(emailToUse: string, passwordToUse: string) {
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: passwordToUse,
    });

    if (signInError) {
      return signInError.message;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "coach") {
      await supabase.auth.signOut();
      return "This is the coach login. Students should use the school link provided by their coach.";
    }

    router.push("/dashboard");
    router.refresh();
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const failure = await signIn(email, password);
    if (failure) setError(failure);
    setLoading(false);
  }

  async function handleDemo() {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) return;
    setError(null);
    setDemoLoading(true);
    const failure = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    if (failure) setError(failure);
    setDemoLoading(false);
  }

  return (
    <AuthShell tagline="Run your coaching business from one place.">
      <div className="logo-name" style={{ marginBottom: 2 }}>
        Full Circle CRM
      </div>
      <div className="page-sub" style={{ marginBottom: 20 }}>
        Welcome back — sign in to your CRM
      </div>

      {DEMO_EMAIL && DEMO_PASSWORD && (
        <>
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleDemo}
            disabled={demoLoading}
            style={{ width: "100%", justifyContent: "center", marginBottom: 8 }}
          >
            {demoLoading ? "Loading demo…" : "Try the demo"}
          </button>
          <div className="sub" style={{ textAlign: "center", marginBottom: 18 }}>
            Explore a live sample workspace — no account needed. Shared with other visitors, so data may change.
          </div>
          <div className="section-divider" style={{ margin: "0 0 18px" }}>
            <div className="section-divider-line" />
            <span className="section-divider-label">or sign in</span>
            <div className="section-divider-line" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit}>
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
              autoComplete="current-password"
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
        </div>

        {error && (
          <div className="notes-box" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="sub" style={{ marginTop: 14, textAlign: "center" }}>
          No account yet?{" "}
          <Link href="/signup" style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </div>
      <div className="sub" style={{ marginTop: 8, textAlign: "center" }}>Student? Use your school&apos;s private login link.</div>
    </AuthShell>
  );
}
