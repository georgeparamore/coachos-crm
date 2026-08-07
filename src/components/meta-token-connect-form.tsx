"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

export function MetaTokenConnectForm() {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [expanded, setExpanded] = useState(false);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/meta/connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to connect with that token");
      }
      setToken("");
      router.refresh();
    } catch (err) {
      showError(err, "settings.meta-connect-token");
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setExpanded(true)}
        style={{ marginTop: 8 }}
      >
        Or connect with an access token instead
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
      <p className="sub" style={{ marginBottom: 8 }}>
        For when the account owner generates their own token instead of going through the Connect button — in{" "}
        <strong>Business Settings → System Users</strong>, create a system user, assign it the ad account with{" "}
        <strong>ads_read</strong> access, then Generate Token and paste it here.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste access token"
          className="form-input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-sm btn-primary" disabled={submitting || !token.trim()}>
          {submitting ? "Connecting…" : "Connect"}
        </button>
      </div>
    </form>
  );
}
