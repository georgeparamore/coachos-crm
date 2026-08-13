import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { DataLoadError } from "@/components/data-load-error";
import { MetaConnectionRow } from "@/components/meta-connection-row";
import { MetaAdAccountPicker } from "@/components/meta-ad-account-picker";
import { logServerError } from "@/lib/log-server-error";

const META_ERROR_MESSAGES: Record<string, string> = {
  declined: "Meta connection was cancelled.",
  missing_params: "Meta didn't return the expected response — try connecting again.",
  invalid_state: "That connection link expired or was invalid — try connecting again.",
  session_mismatch: "Your session changed mid-connection — try connecting again.",
  save_failed: "Couldn't save the connection — try again, or check the error log if it keeps happening.",
  token_exchange_failed: "Meta rejected the connection request — try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string; meta_detail?: string }>;
}) {
  const { meta: metaStatus, meta_detail: metaDetail } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email, timezone")
    .eq("id", user!.id)
    .single();

  if (error) await logServerError(error, "settings.load", { userId: user!.id, userEmail: user!.email });

  // meta_connections is service-role-only (holds encrypted token material) —
  // read here with the service client, but only ever expose the derived
  // connected/account-name shape below, never the row itself.
  const service = createServiceClient();
  const { data: metaConnection } = await service
    .from("meta_connections")
    .select("id, status")
    .eq("coach_id", user!.id)
    .eq("status", "active")
    .maybeSingle();

  let metaAdAccountName: string | null = null;
  let metaAdAccounts: {
    id: string;
    name: string;
    currency: string;
    is_selected: boolean;
    meta_ad_account_id: string;
    label: string | null;
  }[] = [];
  if (metaConnection) {
    const { data: accounts } = await service
      .from("meta_ad_accounts")
      .select("id, name, currency, is_selected, meta_ad_account_id, label")
      .eq("connection_id", metaConnection.id)
      .order("name");
    metaAdAccounts = accounts ?? [];
    const selectedAccounts = metaAdAccounts.filter((a) => a.is_selected);
    metaAdAccountName =
      selectedAccounts.length > 0 ? selectedAccounts.map((a) => a.label || a.name).join(", ") : null;
  }

  const integrations = [
    { name: "Stripe", sub: "Subscriptions & payments", envVar: "STRIPE_SECRET_KEY" },
    { name: "Bunny.net", sub: "Video hosting & streaming", envVar: "BUNNY_API_KEY" },
    { name: "Email (SMTP)", sub: "Automated client notifications", envVar: "SMTP settings" },
    { name: "Supabase", sub: "Database, auth & user accounts", envVar: "NEXT_PUBLIC_SUPABASE_URL" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Manage your platform, branding, and integrations</div>
        </div>
      </div>

      {error && <DataLoadError what="your profile" />}

      {metaStatus === "connected" && (
        <div className="card" style={{ background: "var(--green-bg)", border: "none" }}>
          <span style={{ color: "var(--green-text)" }}>Meta Ads connected.</span>
        </div>
      )}
      {metaStatus === "error" && (
        <div className="card" style={{ background: "var(--red-bg)", border: "none" }}>
          <span style={{ color: "var(--red-text)" }}>
            {(metaDetail && META_ERROR_MESSAGES[metaDetail]) || "Couldn't connect Meta Ads — try again."}
          </span>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-title">Business profile</div>
          <BusinessProfileForm
            fullName={profile?.full_name ?? ""}
            email={profile?.email ?? user!.email ?? ""}
            timezone={profile?.timezone ?? "UTC"}
          />
        </div>

        <div>
          <div className="card">
            <div className="card-title">Integrations</div>
            <MetaConnectionRow connected={Boolean(metaConnection)} adAccountName={metaAdAccountName} />
            {integrations.map((integration) => (
              <div className="list-row" key={integration.name}>
                <div className="list-row-left">
                  <div>
                    <div className="name">{integration.name}</div>
                    <div className="sub">{integration.sub}</div>
                  </div>
                </div>
                <span className="badge badge-amber">
                  {integration.name === "Supabase" ? "Connected" : "Connect when live"}
                </span>
              </div>
            ))}
          </div>

          {metaConnection && <MetaAdAccountPicker accounts={metaAdAccounts} />}

          <div className="card">
            <div className="card-title">Platform status</div>
            <div className="list-row">
              <div className="sub">Mode</div>
              <span className="badge badge-green">Phase 1 — CRM live</span>
            </div>
            <div className="list-row">
              <div className="sub">Data storage</div>
              <span className="badge badge-blue">Supabase</span>
            </div>
            <div className="list-row">
              <div className="sub">Payments</div>
              <span className="badge badge-amber">Not connected</span>
            </div>
            <div className="list-row">
              <div className="sub">Video hosting</div>
              <span className="badge badge-amber">Not connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
