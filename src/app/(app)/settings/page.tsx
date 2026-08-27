import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { DataLoadError } from "@/components/data-load-error";
import { MetaConnectionRow } from "@/components/meta-connection-row";
import { MetaAdAccountPicker } from "@/components/meta-ad-account-picker";
import { MetaLeadIntakeCard } from "@/components/meta-lead-intake-card";
import { logServerError } from "@/lib/log-server-error";
import { BusinessManager } from "@/components/business-manager";
import { ZoomDiscoveryIntegration } from "@/components/zoom-discovery-integration";
import type { Business } from "@/lib/businesses";

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
  const { data: businesses } = await supabase.from("businesses").select("*").eq("coach_id", user!.id).order("is_default", { ascending: false }).order("name");
  const { data: zoomDiscoveryIntegration } = await supabase.from("discovery_call_integrations").select("id,business_id,zoom_account_id,host_email,enabled").eq("coach_id", user!.id).maybeSingle();

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
  let metaAdAccounts: { id: string; name: string; currency: string; is_selected: boolean; meta_ad_account_id: string }[] = [];
  let metaLeadSources: { id: string; business_id: string; meta_page_id: string; page_name: string | null; meta_form_id: string | null; form_name: string | null; last_received_at: string | null }[] = [];
  let metaLeadHealth: { processed: number; failed: number; unmapped: number; lastEventAt: string | null } = { processed: 0, failed: 0, unmapped: 0, lastEventAt: null };
  if (metaConnection) {
    const { data: accounts } = await service
      .from("meta_ad_accounts")
      .select("id, name, currency, is_selected, meta_ad_account_id")
      .eq("connection_id", metaConnection.id)
      .order("name");
    metaAdAccounts = accounts ?? [];
    metaAdAccountName = metaAdAccounts.find((a) => a.is_selected)?.name ?? null;
    const { data: leadSources } = await service.from("meta_lead_sources").select("id, business_id, meta_page_id, page_name, meta_form_id, form_name, meta_ad_account_id, last_received_at").eq("coach_id", user!.id).eq("enabled", true).order("created_at");
    metaLeadSources = leadSources ?? [];
    const { data: leadEvents } = await service.from("meta_lead_webhook_events").select("status, created_at").eq("coach_id", user!.id).order("created_at", { ascending: false }).limit(100);
    metaLeadHealth = {
      processed: (leadEvents ?? []).filter((event) => event.status === "processed" || event.status === "duplicate").length,
      failed: (leadEvents ?? []).filter((event) => event.status === "failed").length,
      unmapped: (leadEvents ?? []).filter((event) => event.status === "unmapped").length,
      lastEventAt: leadEvents?.[0]?.created_at ?? null,
    };
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
        <div>
          <div className="card">
            <div className="card-title">Business profile</div>
            <BusinessProfileForm
              fullName={profile?.full_name ?? ""}
              email={profile?.email ?? user!.email ?? ""}
              timezone={profile?.timezone ?? "UTC"}
            />
          </div>
          <BusinessManager initialBusinesses={(businesses as Business[]) ?? []} coachId={user!.id} />
        </div>

        <div>
          <div className="card">
            <div className="card-title">Integrations</div>
            <MetaConnectionRow
              connected={Boolean(metaConnection)}
              adAccountName={metaAdAccountName}
              metaAppId={process.env.META_APP_ID ?? null}
            />
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
          {metaConnection && <MetaLeadIntakeCard sources={metaLeadSources} businesses={(businesses as Business[]) ?? []} health={metaLeadHealth} webhookReady={Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN && process.env.META_APP_SECRET)} verifyToken={process.env.META_WEBHOOK_VERIFY_TOKEN ?? null} />}
          <ZoomDiscoveryIntegration businesses={(businesses as Business[]) ?? []} integration={zoomDiscoveryIntegration} credentialsReady={Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET && process.env.ZOOM_WEBHOOK_SECRET_TOKEN && process.env.OPENAI_API_KEY)} />

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
