"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

export function InviteClientForm() {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: fullName || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to create invite");
      }
      setInviteUrl(body.inviteUrl);
      setEmail("");
      setFullName("");
      router.refresh();
    } catch (err) {
      showError(err, "clients.invite");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="form-input"
          type="email"
          required
          placeholder="Client email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <input
          className="form-input"
          placeholder="Name (optional)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{ flex: "1 1 160px" }}
        />
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send invite"}
        </button>
      </form>

      {inviteUrl && (
        <div className="notes-box" style={{ marginTop: 12 }}>
          Invite created. Since email sending isn&apos;t set up yet, copy this link and send it to your client directly:
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <code style={{ fontSize: 12, wordBreak: "break-all", flex: 1 }}>{inviteUrl}</code>
            <button type="button" className="btn btn-sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
