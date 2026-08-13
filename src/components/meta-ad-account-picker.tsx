"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useErrorToast } from "@/components/error-toast-provider";

type AdAccount = {
  id: string;
  name: string;
  currency: string;
  is_selected: boolean;
  meta_ad_account_id: string;
  label: string | null;
};

export function MetaAdAccountPicker({ accounts }: { accounts: AdAccount[] }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(
    Object.fromEntries(accounts.map((a) => [a.id, a.label ?? ""])),
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/meta/refresh-accounts", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to refresh ad accounts");
      }
      router.refresh();
    } catch (err) {
      showError(err, "settings.meta-refresh-accounts");
    } finally {
      setRefreshing(false);
    }
  }

  async function updateAccount(adAccountId: string, body: Record<string, unknown>) {
    setPendingId(adAccountId);
    try {
      const res = await fetch("/api/meta/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId, ...body }),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody.error || "Failed to update ad account");
      }
      router.refresh();
    } catch (err) {
      showError(err, "settings.meta-select-account");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div className="card-title">Meta ad accounts</div>
        <button className="btn btn-sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh accounts"}
        </button>
      </div>
      <p className="sub" style={{ marginBottom: 12 }}>
        {accounts.length === 0
          ? "No ad accounts found yet. If one was just shared with you (e.g. via Assign Partner), click Refresh accounts."
          : "Turn on syncing for each ad account you want tracked — more than one at a time is fine, e.g. separate businesses. Give each a label so they're easy to tell apart on Ad performance."}
      </p>
      {accounts.map((account) => (
        <div className="list-row" key={account.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div>
              <div className="name">{account.name}</div>
              <div className="sub">
                {account.currency} · {account.meta_ad_account_id}
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => updateAccount(account.id, { selected: !account.is_selected })}
              disabled={pendingId === account.id}
            >
              {pendingId === account.id
                ? "Saving…"
                : account.is_selected
                  ? "Syncing — remove"
                  : "Not syncing — add"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              placeholder="Label (e.g. business name)"
              value={labelDrafts[account.id] ?? ""}
              onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [account.id]: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-sm"
              onClick={() => updateAccount(account.id, { label: labelDrafts[account.id] ?? "" })}
              disabled={pendingId === account.id || (labelDrafts[account.id] ?? "") === (account.label ?? "")}
            >
              Save label
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
