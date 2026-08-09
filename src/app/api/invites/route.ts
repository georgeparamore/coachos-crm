import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-server-error";

export const runtime = "nodejs";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "coach") {
    return NextResponse.json({ error: "Only a coach account can invite clients" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" && body.fullName.trim() ? body.fullName.trim() : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const token = randomBytes(24).toString("base64url");

  const { data: invite, error } = await supabase
    .from("client_invites")
    .insert({ coach_id: user.id, email, full_name: fullName, token })
    .select("id, token")
    .single();

  if (error) {
    // Unique violation on (coach_id, lower(email)) where status = 'pending'
    if (error.code === "23505") {
      return NextResponse.json({ error: "There's already a pending invite for that email" }, { status: 409 });
    }
    await logServerError(error, "invites.create", { userId: user.id, userEmail: user.email });
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  return NextResponse.json({ id: invite.id, inviteUrl: `${appUrl()}/invite/${invite.token}` });
}
