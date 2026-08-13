import { createServiceClient } from "@/lib/supabase/service";
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { notFound } from "next/navigation";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: invite } = await supabase
    .from("client_invites")
    .select("email, full_name, status, coach_id, business_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite) notFound();

  const { data: coach } = await supabase.from("profiles").select("full_name").eq("id", invite.coach_id).maybeSingle();
  const { data: school } = await supabase.from("businesses").select("portal_name, portal_tagline, slug, color").eq("id", invite.business_id).maybeSingle();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div className="card" style={{ width: 380, marginBottom: 0, borderTop: `3px solid ${school?.color ?? "var(--accent)"}` }}>
        <div className="logo-name" style={{ marginBottom: 2 }}>
          {school?.portal_name ?? "Your school"}
        </div>
        <div className="page-sub" style={{ marginBottom: 20 }}>
          {coach?.full_name ? `${coach.full_name} invited you to join` : "You've been invited"}
        </div>

        {invite.status === "accepted" ? (
          <div className="notes-box">This invite has already been used. Head to the login page to sign in.</div>
        ) : invite.status === "revoked" ? (
          <div className="notes-box">This invite is no longer valid — ask your coach to send a new one.</div>
        ) : (
          <AcceptInviteForm token={token} email={invite.email} defaultFullName={invite.full_name ?? ""} schoolSlug={school?.slug ?? null} />
        )}
      </div>
    </div>
  );
}
