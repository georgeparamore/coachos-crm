import { createClient } from "@/lib/supabase/server";
import { InviteClientForm } from "@/components/invite-client-form";
import { RevokeInviteButton } from "@/components/revoke-invite-button";
import { DataLoadError } from "@/components/data-load-error";
import { logServerError } from "@/lib/log-server-error";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [membershipsRes, invitesRes] = await Promise.all([
    supabase
      .from("coach_client_memberships")
      .select("id, status, invited_at, accepted_at, client_id")
      .eq("coach_id", user!.id)
      .order("invited_at", { ascending: false }),
    supabase
      .from("client_invites")
      .select("id, email, full_name, status, invited_at")
      .eq("coach_id", user!.id)
      .eq("status", "pending")
      .order("invited_at", { ascending: false }),
  ]);

  const { data: memberships } = membershipsRes;
  const { data: invites } = invitesRes;

  const clientIds = (memberships ?? []).map((m) => m.client_id);
  const { data: clientProfiles, error: profilesError } =
    clientIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", clientIds)
      : { data: [] as { id: string; full_name: string | null; email: string }[], error: null };

  const queryErrors = [membershipsRes.error, invitesRes.error, profilesError].filter(Boolean);
  if (queryErrors.length > 0) {
    await Promise.all(queryErrors.map((err) => logServerError(err, "clients.load", { userId: user!.id, userEmail: user!.email })));
  }

  const profileById = new Map((clientProfiles ?? []).map((p) => [p.id, p]));
  const activeMemberships = (memberships ?? []).filter((m) => m.status !== "revoked");
  const pendingInvites = invites ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-sub">Invite clients and manage who has access to your courses and community</div>
        </div>
      </div>

      {queryErrors.length > 0 && <DataLoadError what="your clients" />}

      <div className="card">
        <div className="card-title">Invite a client</div>
        <InviteClientForm />
      </div>

      {pendingInvites.length > 0 && (
        <div className="card">
          <div className="card-title">Pending invites</div>
          {pendingInvites.map((invite) => (
            <div className="list-row" key={invite.id}>
              <div>
                <div className="name">{invite.full_name || invite.email}</div>
                <div className="sub">
                  {invite.email} · invited {new Date(invite.invited_at).toLocaleDateString()}
                </div>
              </div>
              <RevokeInviteButton inviteId={invite.id} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">Clients</div>
        {activeMemberships.length === 0 ? (
          <div className="empty-state">
            <p>No clients yet. Send an invite above to get started.</p>
          </div>
        ) : (
          activeMemberships.map((membership) => {
            const profile = profileById.get(membership.client_id);
            return (
              <div className="list-row" key={membership.id}>
                <div>
                  <div className="name">{profile?.full_name || profile?.email || "Unknown client"}</div>
                  <div className="sub">{profile?.email}</div>
                </div>
                <span className={membership.status === "active" ? "badge badge-green" : "badge badge-amber"}>
                  {membership.status === "active" ? "Active" : "Invited"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
