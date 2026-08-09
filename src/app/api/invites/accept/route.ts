import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

/** Public, unauthenticated: the invitee has no session yet, so this runs
 * entirely on the service role. Creates the auth user (role: client via
 * handle_new_user's metadata read) and the resulting coach_client_memberships
 * row in one step — there's no intermediate "invited" membership state
 * because coach_client_memberships.client_id can't be set until a profile
 * exists (see 0012_client_invites.sql's header comment). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || !fullName || !password) {
    return NextResponse.json({ error: "Name and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: invite, error: inviteError } = await service
    .from("client_invites")
    .select("id, coach_id, email, status")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been used or revoked" }, { status: 409 });
  }

  const { data: createdUser, error: createUserError } = await service.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { role: "client", full_name: fullName },
  });

  if (createUserError || !createdUser.user) {
    const message = createUserError?.message ?? "";
    if (message.toLowerCase().includes("already been registered") || message.toLowerCase().includes("already exists")) {
      // Not a dead end — the invitee already has an account under this
      // email (as a coach or a client of someone else). They prove it's
      // theirs by logging in, which /api/invites/accept-existing then
      // links to this invite instead of creating a new account.
      return NextResponse.json(
        { error: "An account with this email already exists.", code: "email_exists" },
        { status: 409 },
      );
    }
    await logServerError({ message }, "invites.accept.create_user", {});
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  const { error: membershipError } = await service.from("coach_client_memberships").insert({
    coach_id: invite.coach_id,
    client_id: createdUser.user.id,
    status: "active",
    accepted_at: new Date().toISOString(),
  });

  if (membershipError) {
    await logServerError(membershipError, "invites.accept.create_membership", { userId: createdUser.user.id });
    return NextResponse.json({ error: "Account created, but failed to link to your coach — contact them directly" }, { status: 500 });
  }

  await service
    .from("client_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, email: invite.email });
}
