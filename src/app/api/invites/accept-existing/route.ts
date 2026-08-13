import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

/** Companion to /api/invites/accept for the "email already has an account"
 * case: the invitee proves ownership by logging in client-side first (see
 * AcceptInviteForm), then this runs with their real session — no account
 * creation, just linking their existing profile to the inviting coach via
 * coach_client_memberships. Still needs the service role for the actual
 * insert since coach_client_memberships' RLS only grants the coach (not an
 * arbitrary client) insert access. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: invite, error: inviteError } = await service
    .from("client_invites")
    .select("id, coach_id, business_id, email, status")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been used or revoked" }, { status: 409 });
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "This invite was sent to a different email than the account you logged into" }, { status: 403 });
  }

  const { error: membershipError } = await service.from("coach_client_memberships").upsert(
    {
      coach_id: invite.coach_id,
      business_id: invite.business_id,
      client_id: user.id,
      status: "active",
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "business_id,client_id" },
  );

  if (membershipError) {
    await logServerError(membershipError, "invites.accept_existing.create_membership", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to link your account to your coach" }, { status: 500 });
  }

  await service
    .from("client_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
