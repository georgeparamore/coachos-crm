"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

export function MetaSyncButton() {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/meta/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to sync");
      }
      router.refresh();
    } catch (err) {
      showError(err, "ads.sync-now");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button className="btn btn-sm" onClick={handleSync} disabled={syncing}>
      {syncing ? "Syncing…" : "Sync now"}
    </button>
  );
}
