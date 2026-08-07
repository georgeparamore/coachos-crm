"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Role = "coach" | "client";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("coach");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function signIn(emailToUse: string, passwordToUse: string, roleToCheck: Role) {
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

    if (!profile || profile.role !== roleToCheck) {
      await supabase.auth.signOut();
      return `No ${roleToCheck} account found for these credentials.`;
    }

    router.push("/dashboard");
    router.refresh();
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const failure = await signIn(email, password, role);
    if (failure) setError(failure);
    setLoading(false);
  }

  async function handleDemo() {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) return;
    setError(null);
    setDemoLoading(true);
    const failure = await signIn(DEMO_EMAIL, DEMO_PASSWORD, "coach");
    if (failure) setError(failure);
    setDemoLoading(false);
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
          Sign in to your platform
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

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 18,
            background: "var(--surface2)",
            padding: 4,
            borderRadius: "var(--radius)",
          }}
        >
          {(["coach", "client"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="btn btn-sm"
              style={{
                flex: 1,
                justifyContent: "center",
                border: "none",
                background: role === r ? "var(--surface)" : "transparent",
                fontWeight: role === r ? 500 : 400,
              }}
            >
              {r === "coach" ? "Coach login" : "Client login"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {role === "coach" && (
          <div className="sub" style={{ marginTop: 14, textAlign: "center" }}>
            No account yet? <Link href="/signup" style={{ color: "var(--accent)" }}>Create one</Link>
          </div>
        )}
      </div>
    </div>
  );
}
