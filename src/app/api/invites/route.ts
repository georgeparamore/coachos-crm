import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-server-error";
import { sendEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

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

  const inviteUrl = new URL(`/invite/${invite.token}`, request.url).toString();

  const coachName = user.user_metadata?.full_name || user.email || "Your coach";
  const { sent, error: emailError } = await sendEmail({
    to: email,
    subject: `${coachName} invited you to join their coaching platform`,
    replyTo: user.email,
    html: `
      <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;">
        <h2 style="margin:0 0 12px;">You're invited</h2>
        <p style="font-size:14px;line-height:1.6;">${coachName} has invited you to join their coaching platform on DJS CRM.</p>
        <p style="margin:20px 0;">
          <a href="${inviteUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Accept invite</a>
        </p>
        <p style="font-size:12px;color:#999;">Or paste this link into your browser: ${inviteUrl}</p>
      </div>`,
    text: `${coachName} has invited you to join their coaching platform on DJS CRM.\n\nAccept your invite: ${inviteUrl}`,
  });

  if (!sent && emailError) {
    await logServerError({ message: emailError }, "invites.email_send_failed", { userId: user.id, userEmail: user.email });
  }

  return NextResponse.json({ id: invite.id, inviteUrl, emailSent: sent });
}
