"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [revoking, setRevoking] = useState(false);

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch(`/api/invites/${inviteId}/revoke`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to revoke invite");
      }
      router.refresh();
    } catch (err) {
      showError(err, "clients.revoke-invite");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <button className="btn btn-sm" onClick={handleRevoke} disabled={revoking}>
      {revoking ? "Revoking…" : "Revoke"}
    </button>
  );
}
