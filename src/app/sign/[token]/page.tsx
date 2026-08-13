import { createServiceClient } from "@/lib/supabase/service";
import { SignContractForm } from "@/components/sign-contract-form";
import { centsToDollars } from "@/lib/format";
import { notFound } from "next/navigation";

export default async function SignContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("client_name, contract_type, value_cents, body, status, signer_name, signed_at")
    .eq("sign_token", token)
    .single();

  if (!contract) notFound();

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
      <div className="logo-name" style={{ marginBottom: 4 }}>
        Full Circle CRM
      </div>
      <div className="page-sub" style={{ marginBottom: 24 }}>
        {contract.contract_type} for {contract.client_name}
        {contract.value_cents ? ` · ${centsToDollars(contract.value_cents)}` : ""}
      </div>

      <div className="card">
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}>
          {contract.body}
        </pre>
      </div>

      {contract.status === "signed" ? (
        <div className="notes-box" style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
          Signed by {contract.signer_name} on{" "}
          {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : ""}.
        </div>
      ) : (
        <SignContractForm token={token} />
      )}
    </div>
  );
}
