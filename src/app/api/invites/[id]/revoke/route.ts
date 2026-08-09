import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // RLS scopes this to the caller's own invites — no separate ownership
  // check needed beyond that.
  const { error } = await supabase
    .from("client_invites")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
