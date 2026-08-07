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
};

export function MetaAdAccountPicker({ accounts }: { accounts: AdAccount[] }) {
  const router = useRouter();
  const { showError } = useErrorToast();
  const [selectingId, setSelectingId] = useState<string | null>(null);

  async function handleSelect(adAccountId: string) {
    setSelectingId(adAccountId);
    try {
      const res = await fetch("/api/meta/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to select ad account");
      }
      router.refresh();
    } catch (err) {
      showError(err, "settings.meta-select-account");
    } finally {
      setSelectingId(null);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title">Meta ad account</div>
      <p className="sub" style={{ marginBottom: 12 }}>
        {accounts.length > 1
          ? "Multiple ad accounts found on this Meta login — choose the one to sync campaign data from."
          : "This is the ad account campaign data syncs from."}
      </p>
      {accounts.map((account) => (
        <div className="list-row" key={account.id}>
          <div>
            <div className="name">{account.name}</div>
            <div className="sub">
              {account.currency} · {account.meta_ad_account_id}
            </div>
          </div>
          {account.is_selected ? (
            <span className="badge badge-green">Selected</span>
          ) : (
            <button className="btn btn-sm" onClick={() => handleSelect(account.id)} disabled={selectingId === account.id}>
              {selectingId === account.id ? "Selecting…" : "Select"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
