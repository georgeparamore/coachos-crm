"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";
import type { Business } from "@/lib/businesses";

export function InviteClientForm({ businesses }: { businesses: Business[] }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [businessId, setBusinessId] = useState(businesses.find((business) => business.is_default)?.id ?? businesses[0]?.id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: fullName || undefined, businessId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to create invite");
      }
      setInviteUrl(body.inviteUrl);
      setEmailSent(Boolean(body.emailSent));
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
        <select className="form-input" required aria-label="Business" value={businessId} onChange={(event) => setBusinessId(event.target.value)} style={{ flex: "1 1 170px" }}>
          {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
        </select>
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
          {emailSent ? (
            "Invite emailed. You can also copy the link below as a backup:"
          ) : (
            <>Invite created, but the email couldn&apos;t be sent — copy this link and send it to your client directly:</>
          )}
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
